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