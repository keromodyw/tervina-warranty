-- FIX: table privileges missing (SQLSTATE 42501 on every query).
--
-- Run this ONCE in Supabase Dashboard -> SQL Editor -> Run if you already
-- applied APPLY-ALL.sql before 20260101120900_10_grants.sql existed.
--
-- Why: the first APPLY-ALL created the tables and their RLS policies but no
-- table GRANTs. A policy filters rows a role may already touch; it does not let
-- the role touch the table at all. So `authenticated` hit "permission denied for
-- table customers" before any policy ran. This is that missing layer.
--
-- This is identical to migration 20260101120900_10_grants.sql. Applying it again
-- on a fresh database is harmless - GRANT is idempotent.

grant usage on schema public to anon, authenticated, service_role;

grant select on public.warranty_rules to anon, authenticated;

grant select on public.customers       to anon;
grant select on public.warranty_claims to anon;
grant select on public.staff           to anon;

grant select, insert, update         on public.customers       to authenticated;
grant select, insert, update         on public.warranty_claims to authenticated;
grant select, insert, update, delete on public.claim_photos    to authenticated;

grant select, insert, update, delete on public.warranty_rules to authenticated;
grant select, insert, update, delete on public.staff          to authenticated;

grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
