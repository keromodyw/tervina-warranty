-- M1 / step 2: shared helper functions.
--
-- All of these are SECURITY DEFINER with an empty search_path. That is not
-- paranoia, it is required:
--   * is_staff() queries public.staff. Without SECURITY DEFINER the policy on
--     staff re-enters itself and Postgres raises "infinite recursion detected
--     in policy for relation staff".
--   * search_path = '' pins resolution so a caller cannot shadow the function.

-- Is the current auth user an active staff member?
-- Matches on user_id ONLY, never on email. Matching on email would let anyone
-- who signs up with a staff address grant themselves admin.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.staff s
     where s.user_id = auth.uid()
       and s.is_active
  );
$$;

-- Who is the current staff member? Null for customers and anon.
create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
    from public.staff s
   where s.user_id = auth.uid()
     and s.is_active
   limit 1;
$$;

-- Auto-link a pending staff row when that email signs up for the first time.
-- Runs server-side inside the signup transaction, so it cannot be spoofed by the
-- client and there is no window where the row sits unlinked.
create or replace function public.link_staff_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.staff s
     set user_id = new.id,
         full_name = coalesce(
           nullif(s.full_name, ''),
           nullif(new.raw_user_meta_data ->> 'full_name', ''),
           coalesce(new.raw_user_meta_data ->> 'name', ''),
           s.email
         )
   where s.user_id is null
     and s.is_active
     and lower(s.email) = lower(coalesce(new.email, ''))
     and s.id not in (select id from public.staff where user_id = new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_staff_user();

-- Normalise an Egyptian number to +20XXXXXXXXXX.
-- Single source of truth: the app, the tracking RPC and staff search must all
-- agree, otherwise tracking silently returns zero rows for a valid customer.
--
-- Kept deliberately identical to src/core/lib/phone.ts. Two bugs were found and
-- fixed here first, and both are pinned by phone.test.ts on the TS side:
--   1. Arabic-Indic digits (٠-٩) were stripped instead of folded, so a number
--      typed on an Arabic keyboard returned NULL.
--   2. A `length = 11 and left = '1'` branch mangled foreign numbers, turning
--      +1 415 555 2671 into +204155552671.
create or replace function public.normalize_phone(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw is null then null
    when digits = '' then null
    when left(digits, 2) = '00' then
      case when length(digits) > 2 then '+' || substr(digits, 3) else null end
    when digits like '20%' and length(digits) = 12 then '+' || digits
    when left(digits, 1) = '0' then '+20' || ltrim(substr(digits, 2), '0')
    when length(digits) = 10 then '+20' || digits
    else '+' || digits
  end
  from (
    -- Fold Arabic-Indic and Eastern Arabic-Indic digits BEFORE stripping, so a
    -- valid Egyptian number is not deleted to an empty string.
    select regexp_replace(
             translate(coalesce(raw, ''),
                       '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
                       '01234567890123456789'),
             '[^0-9]', '', 'g'
           ) as digits
  ) s;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- is_staff()/current_staff_id() are called from RLS policies, which run as the
-- table owner would, so anon/authenticated need EXECUTE explicitly.
revoke all on function public.is_staff() from public;
revoke all on function public.current_staff_id() from public;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.current_staff_id() to anon, authenticated;
grant execute on function public.normalize_phone(text) to anon, authenticated;