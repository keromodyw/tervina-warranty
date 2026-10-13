-- ============================================================
-- TERVINA WARRANTY - APPLY EVERYTHING, IN THIS ORDER
-- Paste the WHOLE file into Supabase Dashboard -> SQL Editor -> Run.
--
-- Concatenation of supabase/migrations/* + supabase/seed.sql.
-- migrations/ stays the source of truth for supabase db reset.
--
-- DO NOT EDIT BY HAND. Regenerate with:  node tools/build-apply-all.mjs
-- ============================================================

-- ---------- BEGIN supabase\migrations\20260101120000_01_staff.sql ----------
-- M1 / step 1: staff authorisation table.
--
-- Supabase Auth owns credentials; this table owns authorisation (D28).
-- Passwords are NEVER stored here.
--
-- Ordering note: this must exist before public.is_staff() in step 2, because
-- that function body is parsed at creation time (check_function_bodies = on).

create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),

  -- Nullable until the person signs in for the first time. The
  -- on_auth_user_created trigger back-fills it from the signup email.
  user_id    uuid unique references auth.users (id) on delete set null,

  -- Unique case-insensitively without needing the citext extension.
  email      text not null,
  full_name  text not null,
  is_active  boolean not null default true,

  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint staff_email_is_lowercase check (email = lower(email)),
  constraint staff_email_looks_like_email check (position('@' in email) > 1)
);

create unique index if not exists staff_email_lower_key on public.staff (lower(email));

comment on table public.staff is
  'Staff authorisation. Credentials live in auth.users; is_active=false revokes access immediately.';

-- ---------- BEGIN supabase\migrations\20260101120100_02_helpers.sql ----------
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

-- ---------- BEGIN supabase\migrations\20260101120200_03_customers.sql ----------
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

-- ---------- BEGIN supabase\migrations\20260101120300_04_warranty_rules.sql ----------
-- M1 / step 4: warranty_rules (Settings tab, admin-editable).
--
-- Resolves a contradiction in the map: it said "anon gets no access" while also
-- requiring the public wizard to resolve durations from the DB before falling
-- back to the generated constants. Both cannot hold.
--
-- Durations are published warranty terms, not customer data, so they are
-- readable by everyone and writable by staff only. Writes stay locked down,
-- which is what actually protects the data.

create table if not exists public.warranty_rules (
  id              uuid primary key default gen_random_uuid(),

  item_type       text not null,
  product_type         text not null,

  -- NULL is meaningful: product types such as السباحة have no duration yet.
  warranty_months integer,

  updated_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now(),

  constraint warranty_rules_unique_pair unique (item_type, product_type),
  constraint warranty_rules_months_sane check (
    warranty_months is null or warranty_months between 0 and 120
  )
);

comment on column public.warranty_rules.warranty_months is
  'NULL = not configured yet (e.g. السباحة). The wizard falls back to the generated constants, which are also NULL.';

-- Seeded by tools/resolve-warranty.mjs (22 rows) via `supabase db reset`.
-- On an already-migrated database apply it with:
--   psql "$DB_URL" -f supabase/seed.sql

-- ---------- BEGIN supabase\migrations\20260101120400_05_warranty_claims.sql ----------
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

-- ---------- BEGIN supabase\migrations\20260101120500_06_claim_photos.sql ----------
-- M1 / step 6: claim_photos (warranty evidence).

create table if not exists public.claim_photos (
  id             uuid primary key default gen_random_uuid(),

  claim_id       uuid not null references public.warranty_claims (id) on delete cascade,

  -- rosetta_label / product_label -> auto-required, white-corner detection.
  -- bowl_barcode                    -> auto-required, Code128 serial.
  -- invoice                         -> manual, optional, never auto-captured.
  kind            text not null,

  storage_path    text not null,

  -- What the client decoded before asking a human to confirm. Nullable because
  -- an invoice photo carries no barcode.
  detected_serial text,
  sharpness       real,

  created_at      timestamptz not null default now(),

  constraint claim_photos_kind_valid check (
    kind in ('rosetta_label', 'bowl_barcode', 'invoice', 'product_label')
  ),

  -- Enforces the exact claims/{claim_uuid}/{kind}.jpg layout that the storage
  -- RLS policy parses with storage.foldername(). An arbitrary path here would
  -- be readable by the wrong customer, so it is rejected at the database.
  constraint claim_photos_path_fmt check (
    storage_path ~ '^claims/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(rosetta_label|bowl_barcode|invoice|product_label)\.jpg$'
  ),

  constraint claim_photos_detected_serial_digits check (
    detected_serial is null or detected_serial ~ '^[0-9]+$'
  ),
  constraint claim_photos_sharpness_range check (
    sharpness is null or sharpness >= 0
  )
);

create index if not exists claim_photos_claim_idx on public.claim_photos (claim_id);

-- ---------- BEGIN supabase\migrations\20260101120600_07_rls_policies.sql ----------
-- M1 / step 7: row level security.
--
-- Enabling RLS with no policy denies everything, which is the safe default.
-- Every policy below is deny-by-default plus one explicit grant path.
--
-- Verified shape (still needs execution - see notes in the repo):
--   anon A inserts its own customer + claim      -> allowed
--   anon A reads A's claim                        -> allowed
--   anon A reads anon B's claim                   -> 0 rows
--   anon inserts photos under B's claim folder    -> denied (storage policy)
--   anon inserts into staff / warranty_rules      -> denied
--   anon UPDATEs status to 'approved'             -> denied (no update policy)

alter table public.staff          enable row level security;
alter table public.customers      enable row level security;
alter table public.warranty_rules enable row level security;
alter table public.warranty_claims enable row level security;
alter table public.claim_photos   enable row level security;

-- Deliberately NOT using FORCE ROW LEVEL SECURITY here.
--
-- ALTER TABLE ... FORCE ROW LEVEL SECURITY subjects the table OWNER to the
-- policies too. Every helper in this schema is SECURITY DEFINER and runs as the
-- owner, so FORCE would make them all silently fail:
--
--   * public.is_staff() reads public.staff as the owner -> would always return
--     false -> no one could ever be staff -> total admin lockout.
--   * public.track_claims_by_phone() reads customers/claims as the owner ->
--     would always return 0 rows -> tracking silently broken.
--
-- Those failures are silent (no error, just no rows), which is the worst kind.
-- Plain ENABLE RLS is also what Supabase ships by default, and it already
-- covers the real threat model: anon and authenticated are non-owners, so they
-- are fully subject to the policies below. The residual risk is limited to
-- SECURITY DEFINER functions owned by postgres - i.e. only the three written
-- here, each of which is pinned with search_path = '' and grants a narrow
-- column set. Add FORCE back only if you first confirm the definer role holds
-- BYPASSRLS, and re-test steps 9 and 10 after doing so.

-- ---------------------------------------------------------------- staff ----
-- Read/write is staff-only. Note is_staff() is SECURITY DEFINER, which is what
-- stops the policy on `staff` from recursing into itself.

drop policy if exists "staff can read staff" on public.staff;
create policy "staff can read staff"
  on public.staff for select
  to authenticated
  using (public.is_staff());

drop policy if exists "staff can add staff" on public.staff;
create policy "staff can add staff"
  on public.staff for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "staff can update staff" on public.staff;
create policy "staff can update staff"
  on public.staff for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff can remove staff" on public.staff;
create policy "staff can remove staff"
  on public.staff for delete
  to authenticated
  using (public.is_staff());

-- ----------------------------------------------------------- customers ----
-- Ownership is auth_user_id. There is intentionally no policy letting one
-- customer read another, even with a matching phone.

drop policy if exists "customers read own" on public.customers;
create policy "customers read own"
  on public.customers for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "customers insert own" on public.customers;
create policy "customers insert own"
  on public.customers for insert
  to authenticated
  with check (auth_user_id = (select auth.uid()));

drop policy if exists "customers update own" on public.customers;
create policy "customers update own"
  on public.customers for update
  to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists "staff read all customers" on public.customers;
create policy "staff read all customers"
  on public.customers for select
  to authenticated
  using (public.is_staff());

-- ------------------------------------------------------ warranty_rules ----
-- Durations are public warranty terms: readable by anon so the wizard can
-- resolve them, writable by staff only.

drop policy if exists "warranty rules are public reference" on public.warranty_rules;
create policy "warranty rules are public reference"
  on public.warranty_rules for select
  to anon, authenticated
  using (true);

drop policy if exists "staff manage warranty rules" on public.warranty_rules;
create policy "staff manage warranty rules"
  on public.warranty_rules for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ----------------------------------------------------- warranty_claims ----
-- There is deliberately NO update policy for anon/authenticated customers.
-- A customer may file a claim and read it back, but the review columns
-- (status, reviewed_by, sent_to_customer, photos_exported) are staff-only,
-- and the table constraints above agree.

drop policy if exists "customers read own claims" on public.warranty_claims;
create policy "customers read own claims"
  on public.warranty_claims for select
  to authenticated
  using (
    exists (
      select 1 from public.customers c
       where c.id = warranty_claims.customer_id
         and c.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "customers insert own claims" on public.warranty_claims;
create policy "customers insert own claims"
  on public.warranty_claims for insert
  to authenticated
  with check (
    exists (
      select 1 from public.customers c
       where c.id = warranty_claims.customer_id
         and c.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "staff read all claims" on public.warranty_claims;
create policy "staff read all claims"
  on public.warranty_claims for select
  to authenticated
  using (public.is_staff());

drop policy if exists "staff review claims" on public.warranty_claims;
create policy "staff review claims"
  on public.warranty_claims for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete claims" on public.warranty_claims;
create policy "staff delete claims"
  on public.warranty_claims for delete
  to authenticated
  using (public.is_staff());

-- --------------------------------------------------------- claim_photos ----

drop policy if exists "customers read own photos" on public.claim_photos;
create policy "customers read own photos"
  on public.claim_photos for select
  to authenticated
  using (
    exists (
      select 1
        from public.warranty_claims wc
        join public.customers c on c.id = wc.customer_id
       where wc.id = claim_photos.claim_id
         and c.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "customers add own photos" on public.claim_photos;
create policy "customers add own photos"
  on public.claim_photos for insert
  to authenticated
  with check (
    exists (
      select 1
        from public.warranty_claims wc
        join public.customers c on c.id = wc.customer_id
       where wc.id = claim_photos.claim_id
         and c.auth_user_id = (select auth.uid())
    )
  );

drop policy if exists "staff read all photos" on public.claim_photos;
create policy "staff read all photos"
  on public.claim_photos for select
  to authenticated
  using (public.is_staff());

drop policy if exists "staff manage all photos" on public.claim_photos;
create policy "staff manage all photos"
  on public.claim_photos for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------- BEGIN supabase\migrations\20260101120700_08_track_rpc.sql ----------
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

-- ---------- BEGIN supabase\migrations\20260101120800_09_storage.sql ----------
-- M1 / step 9: private photo bucket.
--
-- Warranty photos are evidence that can be used against the customer, so the
-- bucket is private (public = false) and every read is a short-lived signed URL.
--
-- Path contract, enforced by the claim_photos_path_fmt CHECK in step 6:
--   claims/{claim_uuid}/{kind}.jpg
-- The policies below parse segment 2 as the claim uuid and confirm the caller
-- owns that claim, so a customer cannot write into someone else's folder even
-- though they can write into the bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'claim-photos',
  'claim-photos',
  false,
  20971520,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: does this storage object path belong to the current customer?
create or replace function public.storage_object_owned_by_caller(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.warranty_claims wc
      join public.customers c on c.id = wc.customer_id
     where wc.id::text = (storage.foldername(p_name))[2]
       and c.auth_user_id = (select auth.uid())
  );
$$;

revoke all on function public.storage_object_owned_by_caller(text) from public;
grant execute on function public.storage_object_owned_by_caller(text) to authenticated;

-- Uploading: anonymous customers count as `authenticated` once signed in, which
-- is exactly why signIns must be anonymous.
drop policy if exists "customers upload own claim photos" on storage.objects;
create policy "customers upload own claim photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'claim-photos'
    and (storage.foldername(name))[1] = 'claims'
    and public.storage_object_owned_by_caller(name)
  );

-- Reading your own photos back (e.g. the review step before submit).
drop policy if exists "customers read own claim photos" on storage.objects;
create policy "customers read own claim photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'claim-photos'
    and public.storage_object_owned_by_caller(name)
  );

-- Staff review and the ZIP export run through this policy.
drop policy if exists "staff read any claim photo" on storage.objects;
create policy "staff read any claim photo"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'claim-photos' and public.is_staff());

-- No customer UPDATE or DELETE policy on purpose. A claim's evidence is
-- append-only once captured; staff may remove it.

drop policy if exists "staff delete claim photo" on storage.objects;
create policy "staff delete claim photo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'claim-photos' and public.is_staff());

-- ---------- BEGIN supabase\seed.sql ----------
-- AUTO-GENERATED by tools/resolve-warranty.mjs - do not hand-edit.
-- Baseline for the admin Settings tab (D22). Durations are snapshotted
-- onto each claim at submit (D25), so editing a row here never rewrites
-- an issued certificate.

insert into warranty_rules (item_type, product_type, warranty_months) values
  ('طلمبات ايطالى تحضير', 'فاما', 84),
  ('طلمبات ايطالى تحضير', 'ماتريكس', 84),
  ('طلمبات ايطالى تحضير', 'رافيلو', 84),
  ('طلمبات ايطالى تحضير', 'رودلف', 36),
  ('طلمبات ايطالى تحضير', 'فينوكس', 36),
  ('طلمبات صينى تحضير', 'ترفينا', 24),
  ('طلمبات صينى تحضير', 'ترفينا بريمير', 24),
  ('طلمبات صينى تحضير', 'ميرو', 12),
  ('طلمبات صينى تحضير', 'ميرو بريمير', 12),
  ('طلمبات صينى تحضير', 'كيرمينا', 12),
  ('طلمبات صينى تحضير', 'كرمينا بريمير', 12),
  ('طلمبات صينى تحضير', 'فرندس', 12),
  ('طلمبات اعماق', 'فاما', 60),
  ('طلمبات اعماق', 'ترفينا', 60),
  ('طلمبات غاطس', 'فاما', 60),
  ('طلمبات غاطس', 'ترفينا', 60),
  ('حمايه', 'خزان تيوبلس 19لتر', 12),
  ('حمايه', 'خزان تيوبلس 24 لتر', 18),
  ('سباحه', 'scp', NULL),
  ('سباحه', 'sbp', NULL),
  ('سباحه', 'lp', NULL),
  ('سباحه', 'vmax', NULL)
on conflict (item_type, product_type) do nothing;
