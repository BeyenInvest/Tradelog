-- =========================================================
-- Beyen Invest — migration: profiles table + auto-provisioning
--
-- Prerequisite for public self-serve signup (moving from one manually
-- created account to a self-serve multi-tenant app). auth.users is owned by
-- the auth schema and shouldn't be extended directly; the standard Supabase
-- pattern is a `profiles` table keyed 1:1 on auth.users(id), populated
-- automatically via an AFTER INSERT trigger on auth.users running as
-- SECURITY DEFINER (the client's JWT has no insert rights on auth.users, so
-- provisioning must run with elevated privileges, scoped tightly to just
-- this insert).
--
-- `plan` defaults to 'free' now so a future billing integration doesn't
-- require a backfill migration on every existing row — no billing logic is
-- wired up yet, this is only the hook point for it.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_owner_select" on profiles
  for select using (id = auth.uid());
create policy "profiles_owner_update" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- Deliberately no insert/delete policy for the client: rows are created only
-- by the trigger below, and removed via the auth.users FK's on delete cascade.

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at(); -- already defined in schema.sql

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
