-- M7 / step 12: shorter, item-related activation codes + expose the decline
-- reason to the customer.
--
--   activation_code : was 'TV-' + 10 random hex. Now 'TV-<item>-<4 chars>'
--     (e.g. TV-DP-7K2F), where <item> is a short Latin code for the Arabic item
--     type, so support can recognise the family of the unit at a glance and
--     search/group by it. The random suffix uses an unambiguous base32 alphabet
--     (no I/O/0/1) and is retried until unique.
--     The format CHECK is widened, not replaced, so pre-existing 10-hex codes
--     still validate and no old row is touched.
--
--   track_claims_by_phone : now also returns decline_reason, so a declined
--     customer is told why. Still returns no PII.

-- 1. item-type -> short Latin code
create or replace function public.activation_item_code(p_item_type text)
returns text
language sql
immutable
as $$
  select case p_item_type
    when 'طلمبات ايطالى تحضير' then 'IT'
    when 'طلمبات صينى تحضير'  then 'CN'
    when 'طلمبات اعماق'        then 'DP'
    when 'طلمبات غاطس'         then 'SB'
    when 'حمايه'               then 'PR'
    when 'سباحه'               then 'SW'
    else 'GN'
  end;
$$;

comment on function public.activation_item_code(text) is
  'Short Latin code for an Arabic item_type, used in activation codes.';

-- 2. generator: item code + random suffix, retried until unique.
--    SECURITY DEFINER so the uniqueness probe is not itself filtered by RLS.
create or replace function public.assign_activation_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_code text := public.activation_item_code(new.item_type);
  alphabet  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i         int;
begin
  loop
    candidate := 'TV-' || item_code || '-';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.warranty_claims wc where wc.activation_code = candidate
    );
  end loop;
  new.activation_code := candidate;
  return new;
end;
$$;

-- 3. widen the code format check: new item codes AND legacy 10-hex codes.
alter table public.warranty_claims drop constraint if exists claims_activation_code_fmt;
alter table public.warranty_claims
  add constraint claims_activation_code_fmt check (
    activation_code is null
    or activation_code ~ '^TV-[0-9A-F]{10}$'
    or activation_code ~ '^TV-[A-Z]{2}-[A-Z0-9]{4}$'
  );

-- 4. tracking reports the decline reason too (return type changes -> recreate).
drop function if exists public.track_claims_by_phone(text);
create function public.track_claims_by_phone(p_phone text)
returns table (
  activation_code text,
  serial          text,
  item_type       text,
  product_type    text,
  capacity        text,
  status          text,
  decline_reason  text,
  warranty_start  date,
  warranty_end    date,
  submitted_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    wc.activation_code,
    wc.serial,
    wc.item_type,
    wc.product_type,
    wc.capacity,
    wc.status,
    wc.decline_reason,
    wc.warranty_start,
    wc.warranty_end,
    wc.created_at
  from public.warranty_claims wc
  join public.customers c on c.id = wc.customer_id
  where c.phone = public.normalize_phone(p_phone)
  order by wc.created_at desc;
$$;

comment on function public.track_claims_by_phone(text) is
  'Customer-facing lookup by phone. Deliberately returns no PII.';

revoke all on function public.track_claims_by_phone(text) from public;
grant execute on function public.track_claims_by_phone(text) to anon, authenticated;
