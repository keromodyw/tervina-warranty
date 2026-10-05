-- M1 / step 5: warranty_claims (the activation record).
--
-- Canonical item_type/product/capacity values come from the GENERATED
-- src/data/productOptions.ts. They are deliberately NOT re-declared as CHECK
-- constraints here: a copy would drift from the generator and quietly start
-- rejecting real submissions.

create table if not exists public.warranty_claims (
  id              uuid primary key default gen_random_uuid(),

  -- كود التفعيله - what the customer reads out to support. Assigned on insert.
  activation_code text unique,

  customer_id     uuid not null references public.customers (id) on delete cascade,

  -- Kept as text, never an integer. PROJECT_MAP [Serial rules]: digits-only,
  -- no fixed length, no numeric cast.
  serial          text not null unique,

  item_type       text not null,
  product_type         text not null,
  capacity        text,

  -- Snapshot of the rule at submission time. Later Settings edits must never
  -- change a certificate that has already been issued.
  warranty_months integer,
  warranty_start  date not null,

  -- Derived, so end date can never contradict duration + start.
  warranty_end    date generated always as (
                     case
                       when warranty_months is null then null
                       else (warranty_start + make_interval(months => warranty_months))::date
                     end
                   ) stored,

  status          text not null default 'pending',

  decline_reason  text,
  reviewed_at     timestamptz,
  reviewed_by     uuid references auth.users (id) on delete set null,

  -- Admin workflow flags (D19).
  sent_to_customer boolean not null default false,
  sent_at          timestamptz,
  photos_exported  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint claims_serial_digits_only check (serial ~ '^[0-9]+$'),
  constraint claims_serial_length_sane check (length(serial) between 1 and 40),
  constraint claims_activation_code_fmt check (
    activation_code is null or activation_code ~ '^TV-[0-9A-F]{10}$'
  ),
  constraint claims_status_valid check (status in ('pending', 'approved', 'declined')),
  constraint claims_decline_needs_reason check (
    status <> 'declined' or (decline_reason is not null and length(btrim(decline_reason)) > 0)
  ),

  -- The WhatsApp message and the ZIP are only ever for approved claims.
  constraint claims_sent_only_when_approved check (
    sent_to_customer = false or status = 'approved'
  ),
  constraint claims_export_only_when_approved check (
    photos_exported = false or status = 'approved'
  ),

  -- Keep the audit flags mutually consistent with their timestamps.
  constraint claims_sent_flag_has_timestamp check (
    sent_to_customer = false or sent_at is not null
  )
);

create index if not exists claims_customer_idx   on public.warranty_claims (customer_id);
create index if not exists claims_status_idx     on public.warranty_claims (status);
create index if not exists claims_created_idx    on public.warranty_claims (created_at desc);

-- كود التفعيله: unguessable, so tracking-by-code could never be used to
-- enumerate other people's claims. Core function, no extension required.
create or replace function public.assign_activation_code()
returns trigger
language plpgsql
as $$
begin
  new.activation_code := 'TV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  return new;
end;
$$;

drop trigger if exists claims_assign_code on public.warranty_claims;
create trigger claims_assign_code
  before insert on public.warranty_claims
  for each row execute function public.assign_activation_code();

drop trigger if exists claims_touch on public.warranty_claims;
create trigger claims_touch
  before insert or update on public.warranty_claims
  for each row execute function public.touch_updated_at();