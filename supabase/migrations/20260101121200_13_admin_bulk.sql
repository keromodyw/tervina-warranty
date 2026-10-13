-- M7 / step 13: staff bulk tooling (legacy import + photo/Excel export).
--
-- Two additive changes, both needed only by the admin panel:
--
--   1. customers.auth_user_id must be nullable. Legacy rows imported from the
--      old ledger have no Supabase Auth identity - they were never signed up
--      through the wizard. UNIQUE already permits many NULLs, so dropping NOT
--      NULL is enough; the ownership policies (auth_user_id = auth.uid()) simply
--      never match a NULL, which is the correct behaviour.
--
--   2. Staff need INSERT on customers and warranty_claims for the import. The
--      customer policies only ever allowed auth_user_id = auth.uid(); staff
--      import creates rows on behalf of people who will never log in.
--
-- Everything else (reads, review updates, deletes) is already covered by the
-- is_staff() policies in step 7.

alter table public.customers alter column auth_user_id drop not null;

drop policy if exists "staff insert customers" on public.customers;
create policy "staff insert customers"
  on public.customers for insert
  to authenticated
  with check (public.is_staff());

drop policy if exists "staff update customers" on public.customers;
create policy "staff update customers"
  on public.customers for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff insert claims" on public.warranty_claims;
create policy "staff insert claims"
  on public.warranty_claims for insert
  to authenticated
  with check (public.is_staff());
