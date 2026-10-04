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