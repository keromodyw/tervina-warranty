-- M1 exit test: does RLS actually hold?
--
-- Run AFTER applying migrations + seed. Creates two throwaway claimants, then
-- attempts every cross-tenant read and write that must fail.
--
-- STATUS: authored but NOT YET EXECUTED (no Docker / Supabase CLI on this
-- machine). A clean run is a milestone, not something already proven.
--
-- How to run: Dashboard -> SQL Editor -> paste whole file -> Run.
-- One transaction, rolled back at the end, so no test rows survive.
--
-- Assertion style matters here:
--   * INSERT that violates a WITH CHECK policy RAISES -> catch the exception.
--   * UPDATE/SELECT that violates a USING policy does NOT raise; it simply
--     matches 0 rows. So those are asserted with GET DIAGNOSTICS ROW_COUNT.
--   Asserting updates with EXCEPTION blocks would produce false passes.

begin;

-- ---------------------------------------------------------------- setup ----
do $$
declare
  a_user uuid := gen_random_uuid();
  b_user uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                         email_confirmed_at, created_at, updated_at,
                         raw_app_meta_data, raw_user_meta_data)
  values
    ('00000000-0000-0000-0000-000000000000', a_user, 'authenticated', 'authenticated',
     'a@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}'),
    ('00000000-0000-0000-0000-000000000000', b_user, 'authenticated', 'authenticated',
     'b@example.test', '', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');

  insert into public.customers (auth_user_id, full_name, phone, governorate, city, sector)
  values (a_user, 'A Customer', '01000000001', 'القاهرة', 'مدينة نصر', 'القاهرة');

  insert into public.warranty_claims (customer_id, serial, item_type, product, capacity,
                                      warranty_months, warranty_start)
  select id, '100000000001', 'طلمبات صينى تحضير', 'ترفينا', '1ح', 24, current_date
    from public.customers where full_name = 'A Customer';

  insert into public.customers (auth_user_id, full_name, phone, governorate, city, sector)
  values (b_user, 'B Customer', '01000000002', 'الجيزة', 'الدقي', 'الوجه القبلي');

  insert into public.warranty_claims (customer_id, serial, item_type, product, capacity,
                                      warranty_months, warranty_start)
  select id, '100000000002', 'حمايه', 'خزان تيوبلس 19لتر', null, 12, current_date
    from public.customers where full_name = 'B Customer';
end;
$$;

-- ============================================ as A: own data is allowed ====
select set_config('request.jwt.claims',
  (select json_build_object('sub', auth_user_id, 'role', 'authenticated',
                           'email', 'a@example.test')::text
     from public.customers where full_name = 'A Customer'), true);
set local role authenticated;

do $$
declare n bigint;
begin
  select count(*) into n from public.customers;
  if n <> 1 then raise exception 'FAIL: A should see 1 customer, saw %', n; end if;

  select count(*) into n from public.warranty_claims;
  if n <> 1 then raise exception 'FAIL: A should see 1 claim, saw %', n; end if;

  select count(*) into n from public.warranty_rules;
  if n = 0 then
    raise exception 'FAIL: warranty_rules unreadable - the wizard cannot resolve durations';
  end if;

  -- The auto-assigned activation code must match its documented shape.
  select count(*) into n from public.warranty_claims where activation_code ~ '^TV-[0-9A-F]{10}$';
  if n <> 1 then raise exception 'FAIL: activation_code missing or malformed on % rows', 2 - n; end if;

  -- warranty_end is generated from start + months.
  select count(*) into n from public.warranty_claims
   where warranty_end = (warranty_start + interval '24 months')::date;
  if n <> 1 then raise exception 'FAIL: warranty_end is not start + 24 months'; end if;

  raise notice 'PASS (A): own rows readable, durations public, code + end date correct';
end;
$$;

-- A must not be able to approve its own claim. RLS filters to 0 rows here, so
-- the check is row_count, NOT an exception.
do $$
declare n int;
begin
  update public.warranty_claims set status = 'approved';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: A updated % claim row(s) - self-approval possible', n; end if;
  raise notice 'PASS (A): cannot self-approve (0 of 2 rows updated)';
end;
$$;

reset role;

-- ======================================== as B: cross-tenant denied ====
select set_config('request.jwt.claims',
  (select json_build_object('sub', auth_user_id, 'role', 'authenticated',
                           'email', 'b@example.test')::text
     from public.customers where full_name = 'B Customer'), true);
set local role authenticated;

do $$
declare n bigint;
begin
  select count(*) into n from public.customers;
  if n <> 1 then raise exception 'FAIL: B sees % customers, expected 1 (own)', n; end if;

  select count(*) into n from public.warranty_claims;
  if n <> 1 then
    raise exception 'FAIL: B sees % claims, expected 1 (own) - CROSS-TENANT LEAK', n;
  end if;

  select count(*) into n from public.claim_photos;
  if n <> 0 then raise exception 'FAIL: B sees % photos it does not own', n; end if;

  raise notice 'PASS (B): sees only its own rows';
end;
$$;

-- Setting durations is silent no-ops under RLS, so count rows.
do $$
declare n int;
begin
  update public.warranty_rules set warranty_months = 120
   where item_type = 'حمايه' and product = 'خزان تيوبلس 19لتر';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B changed % warranty rule(s)', n; end if;
  raise notice 'PASS (B): cannot edit warranty durations (0 rows)';
end;
$$;

-- A claim from someone else must not be reviewable by row count.
do $$
declare n int;
begin
  update public.warranty_claims set status = 'declined', decline_reason = 'x'
   where serial = '100000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: B touched % row(s) owned by A', n; end if;
  raise notice 'PASS (B): cannot touch A''s claim (0 rows)';
end;
$$;

-- INSERT violations do raise, so exception handling is correct here.
do $$
begin
  insert into public.staff (email, full_name) values ('b@example.test', 'Impostor');
  raise exception 'FAIL: B inserted a staff row';
exception
  when others then raise notice 'PASS (B): cannot insert staff (SQLSTATE %)', sqlstate;
end;
$$;

do $$
begin
  insert into public.claim_photos (claim_id, kind, storage_path)
  select id, 'bowl_barcode', 'claims/' || id || '/bowl_barcode.jpg'
    from public.warranty_claims where serial = '100000000001';
  raise exception 'FAIL: B attached a photo to A''s claim';
exception
  when others then raise notice 'PASS (B): cannot add photos to A''s claim (SQLSTATE %)', sqlstate;
end;
$$;

reset role;

-- ============================================= as anon: no personal data ====
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare n bigint;
begin
  select count(*) into n from public.staff;
  if n <> 0 then raise exception 'FAIL: anon reads % staff rows', n; end if;

  select count(*) into n from public.customers;
  if n <> 0 then raise exception 'FAIL: anon reads % customer rows', n; end if;

  select count(*) into n from public.warranty_claims;
  if n <> 0 then raise exception 'FAIL: anon reads % claim rows', n; end if;

  select count(*) into n from public.warranty_rules;
  if n = 0 then raise exception 'FAIL: anon cannot read warranty rules'; end if;

  raise notice 'PASS (anon): no personal data, public durations readable';
end;
$$;

do $$
begin
  insert into public.customers (auth_user_id, full_name, phone, governorate, city, sector)
  values (gen_random_uuid(), 'Ghost', '01000000009', 'القاهرة', 'مصر الجديدة', 'القاهرة');
  raise exception 'FAIL: anon inserted a customer';
exception
  when others then raise notice 'PASS (anon): cannot insert customers (SQLSTATE %)', sqlstate;
end;
$$;

reset role;

-- ============================== staff auto-link on first sign-up =============
-- The row is created here as the privileged role, mimicking what
-- bootstrap-first-admin.sql does once.
insert into public.staff (email, full_name, is_active)
values ('owner@tervina.test', 'Owner', true);

do $$
declare v_user uuid := gen_random_uuid(); v_rows bigint;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                         email_confirmed_at, created_at, updated_at,
                         raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
          'owner@tervina.test', '', now(), now(), now(),
          '{"provider":"email","providers":["email"]}', '{}');

  select count(*) into v_rows from public.staff
   where user_id = v_user and is_active;
  if v_rows <> 1 then
    raise exception 'FAIL: signup did not auto-link the pending staff row (matched % rows)', v_rows;
  end if;
  raise notice 'PASS (staff): signup auto-linked user_id';
end;
$$;

-- is_staff() must now be true for that user, and only for them.
select set_config('request.jwt.claims',
  '{"sub":"' || (select user_id::text from public.staff where email = 'owner@tervina.test')
   || '","role":"authenticated","email":"owner@tervina.test"}', true);
set local role authenticated;

do $$
declare n bigint;
begin
  if not public.is_staff() then raise exception 'FAIL: is_staff() false for the linked owner'; end if;

  select count(*) into n from public.warranty_claims;
  if n <> 2 then raise exception 'FAIL: staff sees % claims, expected 2', n; end if;

  -- Now prove deactivation revokes access immediately.
  perform 1;  -- keep plpgsql happy
end;
$$;

reset role;
update public.staff set is_active = false where email = 'owner@tervina.test';
set local role authenticated;

do $$
declare v_staff boolean; n bigint;
begin
  select public.is_staff() into v_staff;
  if v_staff then raise exception 'FAIL: is_staff() still true after is_active = false'; end if;

  select count(*) into n from public.warranty_claims;
  if n <> 0 then raise exception 'FAIL: deactivated staff still sees % claims', n; end if;
  raise notice 'PASS (staff): is_active = false revokes access immediately';
end;
$$;

reset role;

-- ======================================= tracking RPC: works, leaks nothing ==
do $$
declare v_found bigint; v_pii int;
begin
  -- Normalisation must make '01000000001' and '+201000000001' the same person.
  select count(*) into v_found from public.track_claims_by_phone('01000000001');
  if v_found = 0 then raise exception 'FAIL: tracking found nothing for a known number'; end if;

  select count(*) into v_found from public.track_claims_by_phone('+201000000001');
  if v_found = 0 then
    raise exception 'FAIL: +20 form did not normalise to the same number';
  end if;

  select count(*) into v_found from public.track_claims_by_phone('01000000001') t
   where t.serial = '100000000001' and t.status = 'pending';
  if v_found <> 1 then raise exception 'FAIL: tracking returned the wrong shape of row'; end if;

  -- Belt and braces: the result must have no PII column.
  select count(*) into v_pii
    from information_schema.columns
   where table_schema = 'public'
     and table_name like 'track_claims_by_phone%'
     and column_name in ('full_name','phone','auth_user_id','customer_id');
  if v_pii > 0 then raise exception 'FAIL: tracking RPC exposes % PII column(s)', v_pii; end if;

  raise notice 'PASS (tracking): finds the claim, normalises the phone, returns no PII';
end;
$$;

rollback;