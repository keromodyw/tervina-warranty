-- M1 / step 1: staff authorisation table.
--
-- Supabase Auth owns credentials; this table owns authorisation (D28).
-- Passwords are NEVER stored here.
--
-- Ordering note: this must exist before public.is_staff() in step 2, because
-- that function body is parsed at creation time (check_function_bodies = on).

create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),

  -- Nullable until the person signs in for the first time. The
  -- on_auth_user_created trigger back-fills it from the signup email.
  user_id    uuid unique references auth.users (id) on delete set null,

  -- Unique case-insensitively without needing the citext extension.
  email      text not null,
  full_name  text not null,
  is_active  boolean not null default true,

  added_by   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint staff_email_is_lowercase check (email = lower(email)),
  constraint staff_email_looks_like_email check (position('@' in email) > 1)
);

create unique index if not exists staff_email_lower_key on public.staff (lower(email));

comment on table public.staff is
  'Staff authorisation. Credentials live in auth.users; is_active=false revokes access immediately.';