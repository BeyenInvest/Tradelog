-- =========================================================
-- Beyen Invest — migration 0041: first-run onboarding marker (Fase N4)
--
-- profiles.onboarded_at: when the first-run onboarding wizard was completed
-- (or skipped). NULL = never onboarded → the wizard shows on next login.
-- Stamped now() by the client the moment the user finishes/skips it. The wizard
-- collects display_name + timezone and lets the user pick a starting journal
-- (blank or a preset), reusing the cyclus-6 PresetPicker.
--
-- Beta-gated in the UI (useAuth().betaFeatures) like every in-development
-- feature — public signup is still closed, so only the owner/admin reach it.
--
-- Backfill: every EXISTING profile is stamped with its created_at, so no current
-- user (all long past onboarding) ever sees the wizard. Only genuinely new
-- signups insert with onboarded_at NULL.
--
-- Idempotent / re-runnable: add column if not exists + a null-guarded backfill.
--
-- Testing tip: to re-arm the wizard for your own account after this runs:
--   update profiles set onboarded_at = null where email = 'you@example.com';
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0041_onboarded_at.sql
-- =========================================================

alter table profiles add column if not exists onboarded_at timestamptz;

-- Existing users are all past onboarding — stamp them so the wizard never fires.
update profiles set onboarded_at = created_at where onboarded_at is null;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select email, onboarded_at from profiles order by created_at;  -- iedereen gevuld
-- =========================================================
