-- M-step 14: let a declined claim release its serial.
--
-- A serial is unique only while its claim is still in play. Weaker than a plain
-- UNIQUE (step 5): once an admin declines a claim, that serial is free to be
-- activated again, so a customer is never permanently locked out by a rejected
-- submission. Pending and approved claims keep their exclusive hold, which is
-- what stops the same box being registered twice.

alter table public.warranty_claims
  drop constraint if exists warranty_claims_serial_key;

-- Partial unique index: exactly one non-declined claim per serial.
create unique index if not exists claims_serial_active_key
  on public.warranty_claims (serial)
  where status <> 'declined';
