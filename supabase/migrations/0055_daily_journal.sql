-- =========================================================
-- Beyen Invest — migration: daily journal (dagboek)
-- A short free-text note per calendar day, sitting next to the Habits tracker.
-- Deliberately GLOBAL per user (no methodology_id): a daily reflection about the
-- trader's day belongs to the person, not to whichever trading book is active —
-- so the same entries stay visible across every journal switch. A conscious
-- exception to the per-journal isolation that trades/reviews/accounts follow.
--
-- Idempotent — safe to re-run.
-- =========================================================

create table if not exists daily_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The calendar day this note is about. One note per day per user (edit in place).
  entry_date date not null,
  content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One entry per day per user — the app upserts on (user_id, entry_date).
create unique index if not exists daily_journal_entries_user_date_unique
  on daily_journal_entries(user_id, entry_date);

-- List/browse is always "my entries, newest day first".
create index if not exists idx_daily_journal_entries_user_date
  on daily_journal_entries(user_id, entry_date desc);

alter table daily_journal_entries enable row level security;

drop policy if exists "daily_journal_entries_owner_all" on daily_journal_entries;
create policy "daily_journal_entries_owner_all" on daily_journal_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin read-only carve-out (0046-patroon): `to authenticated` zodat anon nooit
-- is_admin() evalueert (zie 0036).
drop policy if exists "daily_journal_entries_admin_select" on daily_journal_entries;
create policy "daily_journal_entries_admin_select" on daily_journal_entries
  for select to authenticated using (is_admin());

drop trigger if exists trg_daily_journal_entries_updated_at on daily_journal_entries;
create trigger trg_daily_journal_entries_updated_at before update on daily_journal_entries
  for each row execute function set_updated_at();
