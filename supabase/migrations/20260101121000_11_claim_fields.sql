-- M7 / step 11: claim fields captured by the wizard but absent from the original
-- schema. Additive and idempotent - safe to re-run on an existing database.
--
--   technician_name / technician_phone : who installed the pump (step 1 collects
--     them; they belong to the claim, not the customer, because the same
--     customer may activate several units installed by different technicians).
--   notes            : free-text review note (staff or customer context).
--   source           : provenance, so imported legacy rows can be told apart
--     from rows filed through the wizard. 'web' is the default for new claims.
--   photos_exported_at : timestamp to pair with the existing photos_exported
--     boolean, matching the sent_at/sent_to_customer convention.

alter table public.warranty_claims
  add column if not exists technician_name     text,
  add column if not exists technician_phone    text,
  add column if not exists notes               text,
  add column if not exists source              text not null default 'web',
  add column if not exists photos_exported_at  timestamptz;

-- kept in sync by trigger like the other audit flags (see step 5)
create or replace function public.sync_photos_exported_at()
returns trigger
language plpgsql
as $$
begin
  if new.photos_exported = true and new.photos_exported_at is null then
    new.photos_exported_at := now();
  elsif new.photos_exported = false then
    new.photos_exported_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists claims_sync_exported_at on public.warranty_claims;
create trigger claims_sync_exported_at
  before insert or update on public.warranty_claims
  for each row execute function public.sync_photos_exported_at();
