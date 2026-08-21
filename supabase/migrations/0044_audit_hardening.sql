-- =========================================================
-- Beyen Invest — migration 0044: audit hardening (Fase Q — launch blockers)
--
-- Three DB-side fixes from the 2026-08 audit (docs/audit-en-launchplan-2026-08.md):
--
--  K1  Privilege escalation: the profiles UPDATE RLS policy limits *rows* (own
--      profile only) but not *columns* — a user could PATCH their own
--      role='admin' (→ the admin read-all policies expose every user's data),
--      beta_features=true or plan. Fix: replace the blanket table-level UPDATE
--      grant with a column-level grant on exactly the six columns the app's
--      updateProfile() writes (useAuth.tsx). updated_at is stamped by the
--      trg_profiles_updated_at trigger, which is exempt from column grants.
--
--  N1  Journal ownership: trades.methodology_id had a plain FK — nothing
--      stopped a write from pointing a trade at a *system template* or another
--      user's journal (the audit found the client can do exactly that when the
--      profile fetch fails and the WPM-template fallback kicks in). Fix: a
--      BEFORE trigger requiring any non-null methodology_id to be one of the
--      trade owner's own (non-system) methodologies. Runs with invoker rights:
--      the methodologies RLS lets a user see their own rows, which is all the
--      check needs.
--
--  N2  GDPR: delete_own_account() deleted auth.users (cascading every DB row)
--      but left the user's screenshot files in the private `screenshots`
--      Storage bucket. Fix: delete the user's `{uid}/...` objects first, in the
--      same function. NOTE for verification: confirm on a scratch account that
--      the objects actually disappear — if the postgres role were ever denied
--      DML on storage.objects, this delete could silently affect 0 rows.
--
-- Idempotent / re-runnable: grants and create-or-replace converge; the trigger
-- is dropped-then-created.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0044_audit_hardening.sql
-- =========================================================

-- ---------------------------------------------------------
-- K1 — column-level UPDATE grant on profiles
-- ---------------------------------------------------------
-- Supabase's default privileges hand authenticated a blanket UPDATE on every
-- table; revoke it and re-grant only the self-service columns. role, plan,
-- beta_features, email, id, created_at, updated_at become DB-rejected (42501)
-- on any client PATCH, whatever the RLS row check says.
revoke update on table profiles from authenticated;
grant update (display_name, hide_fase, timezone, methodology_id, result_unit, onboarded_at)
  on table profiles to authenticated;

-- anon has no profiles RLS policy (0 rows) — drop its default table grants too,
-- same "anon niets" hygiene as 0038/0040. The share RPCs read profiles as
-- SECURITY DEFINER, so they don't rely on this grant.
revoke all on table profiles from anon;

-- ---------------------------------------------------------
-- N1 — trades.methodology_id must be an own, non-system journal
-- ---------------------------------------------------------
create or replace function enforce_trades_journal_ownership() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.methodology_id is not null and not exists (
    select 1 from methodologies m
    where m.id = new.methodology_id
      and m.user_id = new.user_id
      and not m.is_system
  ) then
    raise exception 'trades.methodology_id must reference one of the trade owner''s own journals (not a system template)'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trades_journal_ownership on trades;
create trigger trg_trades_journal_ownership
  before insert or update of methodology_id, user_id on trades
  for each row execute function enforce_trades_journal_ownership();

-- ---------------------------------------------------------
-- N2 — account deletion also erases the user's Storage screenshots
-- ---------------------------------------------------------
-- Same shape as schema.sql / 0006, plus the storage cleanup. SECURITY DEFINER:
-- the client's JWT has no delete rights on auth.users. Only ever touches the
-- caller's own data (auth.uid(), never a parameter).
create or replace function delete_own_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  -- GDPR right to erasure covers the uploaded chart screenshots too. Files live
  -- under a per-user `{uid}/...` prefix (0039); deleting the storage.objects
  -- rows removes them from the private bucket. Must run BEFORE the user row is
  -- gone, while auth.uid() still resolves.
  delete from storage.objects
  where bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_own_account() from public;
grant execute on function delete_own_account() to authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--
--   -- K1: alleen de zes self-service kolommen zijn nog schrijfbaar
--   select column_name from information_schema.column_privileges
--   where grantee = 'authenticated' and table_name = 'profiles' and privilege_type = 'UPDATE'
--   order by column_name;
--   -- verwacht: display_name, hide_fase, methodology_id, onboarded_at, result_unit, timezone
--
--   select count(*) from information_schema.role_table_grants
--   where grantee = 'anon' and table_name = 'profiles';                        -- 0 rijen
--
--   -- N1: trigger bestaat
--   select tgname from pg_trigger where tgname = 'trg_trades_journal_ownership';
--
--   -- N1: geen bestaande rij overtreedt de regel (trigger geldt alleen voor
--   -- nieuwe writes — dit checkt de zittende data)
--   select t.id from trades t
--   join methodologies m on m.id = t.methodology_id
--   where m.user_id is distinct from t.user_id or m.is_system;                 -- 0 rijen
--
--   -- N2: functie bevat de storage-delete
--   select prosrc like '%storage.objects%' from pg_proc where proname = 'delete_own_account';
--
-- App-verificatie (als ingelogde niet-admin, bv. via de browser-console):
--   update profiles set role = 'admin'      → moet falen (permission denied)
--   update profiles set beta_features=true  → moet falen
--   update profiles set display_name='x'    → moet slagen
--   trade opslaan met methodology_id van een systeem-template → moet falen
--   account-delete met een wegwerp-account mét screenshot → map {uid}/ is leeg
-- =========================================================
