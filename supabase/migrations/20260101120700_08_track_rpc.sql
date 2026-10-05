-- M1 / step 8: public tracking by phone.
--
-- This is the one function that must read across customers, so it is SECURITY
-- DEFINER and therefore bypasses RLS. That is a real exposure - PostgREST makes
-- every SECURITY DEFINER function in public/ callable by anon. The mitigation
-- is the column list, not the privilege:
--
--   returns serial, item type, product, capacity, status and dates
--   never returns customer name, phone, auth_user_id or photo paths
--
-- So the worst an attacker gets is the intended feature: warranty status for a
-- phone number they already know. It cannot enumerate people, and it cannot
-- read a claim by id. Activation codes are unguessable (see step 5).
--
-- If you ever need to expose this publicly, confirm the definer role's
-- BYPASSRLS status first - see the FORCE RLS note in step 7.

create or replace function public.track_claims_by_phone(p_phone text)
returns table (
  activation_code text,
  serial          text,
  item_type       text,
  product_type   text,
  capacity        text,
  status          text,
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

-- Default-privilege hygiene: PUBLIC gets nothing, then grant exactly anon+auth.
revoke all on function public.track_claims_by_phone(text) from public;
grant execute on function public.track_claims_by_phone(text) to anon, authenticated;