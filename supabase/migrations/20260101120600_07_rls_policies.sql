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