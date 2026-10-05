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