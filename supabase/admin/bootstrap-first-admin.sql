-- Bootstrap the FIRST admin. Not a migration - run this by hand exactly once.
--
-- Why a manual step: migrations must be reproducible on every machine, so they
-- can never create a real person's account. This file is the deliberate
-- exception, and it lives outside supabase/migrations/ on purpose.
--
-- How to run:
--   1. Edit v_email and v_name below (both must be lowercase).
--   2. Paste into Supabase Dashboard -> SQL Editor and run it.
--   3. In Authentication -> Users, "Add user" with that same email.
--      No email confirmation needed; the trigger links it automatically.
--   4. The staff row's user_id fills in on insert. Verify:
--        select user_id, email, is_active from public.staff;
--
-- Step 3 does not need a password for the account to gain admin rights - the
-- trigger only matches the email. Set a password when you create the user so the
-- person can actually sign in.

do $$
declare
  v_email text := 'first-admin@example.com';
  v_name  text := 'FIRST ADMIN FULL NAME';
begin
  if v_email like '%@example.com%' then
    raise exception 'Edit v_email in this file before running (got %)', v_email;
  end if;

  if v_name like '%FIRST ADMIN%' or v_name = '' then
    raise exception 'Edit v_name in this file before running (got %)', v_name;
  end if;

  if v_email <> lower(v_email) then
    raise exception 'v_email must be lowercase (got %) - staff_email_is_lowercase rejects it', v_email;
  end if;

  insert into public.staff (email, full_name, is_active)
  values (v_email, v_name, true)
  on conflict (lower(email)) do update
    set full_name  = excluded.full_name,
        is_active  = true,
        user_id    = null;   -- force a fresh link on next login

  raise notice 'Staff row ready for %. They become admin as soon as they sign up with that email.', v_email;
end;
$$;

-- Future staff are added from the admin UI, which inserts into this same table.
-- To promote someone without the UI, repeat the block above with their email.