-- M1 / step 3: customers (the anonymous claimant).
--
-- DEVIATION FROM D5, deliberate - read before changing.
-- The map specifies phone UNIQUE ("shared numbers collapse to one customer").
-- That cannot be combined with per-user ownership safely:
--
--   1. Availability hole. A second family member sharing the number cannot
--      INSERT (unique violation) and cannot read the owner's row (RLS), so they
--      are simply unable to activate a pump at all.
--   2. Hijack hole. Making the app "helpfully" re-point that row at the new
--      auth user means anyone who knows a phone number can take over someone
--      else's dashboard and read their claims.
--
-- Shared numbers stay collapsed where it actually matters - tracking, which
-- matches on phone and returns every claim on that number. Claim ownership stays
-- bound to auth_user_id, so no one can read or attach to another user's rows.
-- So: phone is indexed, NOT unique.

create table if not exists public.customers (
  id           uuid primary key default gen_random_uuid(),

  -- One customer row per signed-in (anonymous) session. The wizard upserts on
  -- this so a refresh/retry does not create duplicates.
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,

  full_name    text not null,
  phone        text not null,
  governorate  text not null,
  city         text not null,

  -- Derived from governorate/city by the shared mapping, snapshotted so a later
  -- mapping change cannot retroactively alter an issued certificate.
  sector       text not null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint customers_phone_is_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint customers_name_not_blank check (length(btrim(full_name)) > 0)
);

create index if not exists customers_phone_idx on public.customers (phone);
create index if not exists customers_governorate_city_idx
  on public.customers (governorate, city);

-- Store the number already normalised so lookups and tracking never depend on
-- client-side formatting.
create or replace function public.set_customer_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone = public.normalize_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists customers_touch on public.customers;
create trigger customers_touch
  before insert or update on public.customers
  for each row execute function public.touch_updated_at();

drop trigger if exists customers_normalize_phone on public.customers;
create trigger customers_normalize_phone
  before insert or update of phone on public.customers
  for each row execute function public.set_customer_phone();