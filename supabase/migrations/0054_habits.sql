-- =========================================================
-- Beyen Invest — migration 0054: habit days (owner-only daily habit tracker)
--
-- A life-level daily habit tracker for the owner's "90-Day Run". One row per
-- (user, day) holds a jsonb bag of the habits completed that day:
-- `{ [habitKey]: true }`. The habit DEFINITIONS live in the app
-- (src/lib/habits.ts), not the DB — this table only records what was done.
--
-- Owner-only in the UI (gated on betaFeatures / useAuth), but scoped per-user in
-- the DB exactly like the other tables — no separate role system. Unlike
-- trade_contracts / weekly_reviews this is NOT journal-scoped: habits are
-- life-level, so there is no methodology_id column.
--
-- No P&L / money is stored — it's a habit tracker.
--
-- Mirrors the trade_contracts (0053) conventions:
--   * id uuid default gen_random_uuid()
--   * user_id uuid not null default auth.uid() references auth.users on delete cascade
--   * RLS on, one owner `for all` policy + the admin read-only carve-out (to authenticated)
-- No updated_at column (the row is upserted in place per day) → no set_updated_at trigger.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

create table if not exists habit_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The calendar day (local date, yyyy-mm-dd) these habits belong to.
  day date not null,
  -- Completed daily habits that day: `{ [habitKey]: true }`. Weekly-target habits
  -- also store `values[key] = true` on each day they happen; the week count is
  -- how many days in the ISO week carry that key.
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- One row per user per day — the hook read-modify-writes it via upsert.
  unique (user_id, day)
);

create index if not exists idx_habit_days_user_day on habit_days(user_id, day);

alter table habit_days enable row level security;

-- Per-user owner policy (select/insert/update/delete), identical style to
-- trade_contracts_owner_all / weekly_reviews_owner_all.
drop policy if exists "habit_days_owner_all" on habit_days;
create policy "habit_days_owner_all" on habit_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin read-only carve-out (0046-patroon): `to authenticated` so anon never
-- evaluates is_admin() (see 0036).
drop policy if exists "habit_days_admin_select" on habit_days;
create policy "habit_days_admin_select" on habit_days
  for select to authenticated using (is_admin());

-- =========================================================
-- Read-only verification (run manually after the migration):
--   select count(*) from information_schema.tables where table_name = 'habit_days';  -- 1
--   select polname from pg_policies where tablename = 'habit_days';
--     -- habit_days_owner_all / habit_days_admin_select
--   select relrowsecurity from pg_class where relname = 'habit_days';                -- t
-- =========================================================
