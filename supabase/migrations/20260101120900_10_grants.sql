-- M1 / step 10: table privileges for the PostgREST roles (anon, authenticated).
--
-- RLS is not access control on its own. A policy only filters rows that a role
-- is already allowed to touch; without a table GRANT the query fails at the
-- privilege layer first, with SQLSTATE 42501 "permission denied for table ...",
-- before any policy is consulted. The earlier migrations created 23 policies and
-- zero table grants, on the assumption that Supabase's default privileges for
-- the public schema would hand anon/authenticated their baseline. They did not
-- apply here, so every read as `authenticated` - i.e. every customer action -
-- failed with 42501.
--
-- Grants are per-command rather than GRANT ALL. anon has no reason to hold
-- DELETE on anything, and writing that down keeps the surface auditable.

grant usage on schema public to anon, authenticated, service_role;

-- Public read: the wizard resolves a duration before anyone signs up, and the
-- tracking page shows status. Writes remain staff-only and are gated by policy.
grant select on public.warranty_rules to anon, authenticated;

-- anon. SELECT is granted so that RLS is what answers - returning zero rows -
-- rather than the privilege layer raising 42501. That distinction matters: a
-- permission error and a policy denial look identical to the app otherwise, and
-- the isolation test could not tell "blocked by policy" from "blocked by grant".
-- No write privileges: anon submits solely through SECURITY DEFINER RPCs.
grant select on public.customers       to anon;
grant select on public.warranty_claims to anon;
grant select on public.staff           to anon;

-- authenticated - the claimant. Every one of these is narrowed by policy to the
-- caller's own rows; the grant just allows the statement to run at all.
grant select, insert, update         on public.customers       to authenticated;
grant select, insert, update         on public.warranty_claims to authenticated;
grant select, insert, update, delete on public.claim_photos    to authenticated;

-- Staff share the `authenticated` role, so rule and staff writes are granted
-- here and gated by is_staff() in the policies rather than by privilege.
grant select, insert, update, delete on public.warranty_rules to authenticated;
grant select, insert, update, delete on public.staff          to authenticated;

-- service_role bypasses RLS by design; used by admin scripts and server jobs.
-- The helper functions revoked EXECUTE from PUBLIC, so it needs it back too.
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
