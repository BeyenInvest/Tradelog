-- =========================================================
-- Beyen Invest — migration: configurable habits
-- Generalises the hardcoded "90-Day Run" list (habits.ts) into user-owned rows.
-- Each user builds their own habits on the Habits page. `habit_days.values` stays
-- keyed by a stable `key`, so existing tick history maps 1:1 once we seed each
-- current tracker's set with the SAME keys. New users get no rows → a blank page.
--
-- Owner/beta-only for now (same betaFeatures gate as the rest of Habits); RLS is
-- per-user regardless. Idempotent — safe to re-run.
-- =========================================================

create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Stable identifier stored in habit_days.values; unique per user. Seeded rows
  -- reuse the legacy keys (keystone/journal/…) so old tick history stays valid.
  key text not null,
  label text not null,
  tier text not null check (tier in ('daily', 'weekly')),
  target integer check (target is null or target > 0), -- only meaningful for weekly
  is_floor boolean not null default false,             -- part of the daily non-negotiable floor
  sort_order integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists idx_habits_user_order on habits(user_id, sort_order);

alter table habits enable row level security;

drop policy if exists "habits_owner_all" on habits;
create policy "habits_owner_all" on habits
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin read-only carve-out (0046-patroon): `to authenticated` zodat anon nooit is_admin() evalueert.
drop policy if exists "habits_admin_select" on habits;
create policy "habits_admin_select" on habits
  for select to authenticated using (is_admin());

drop trigger if exists trg_habits_updated_at on habits;
create trigger trg_habits_updated_at before update on habits
  for each row execute function set_updated_at();

-- Seed existing trackers (anyone who already has habit_days history) with the
-- current 90-Day Run set, using the SAME keys so their history maps 1:1. New
-- users have no habit_days → nothing seeded → they start with a blank page.
insert into habits (user_id, key, label, tier, target, is_floor, sort_order)
select u.user_id, d.key, d.label, d.tier, d.target, d.is_floor, d.ord
from (select distinct user_id from habit_days) u
cross join (values
  ('keystone',  'Keystone: alleen geplande trades, geen FOMO', 'daily',  null::integer, true,  0),
  ('journal',   'Daily journal',                               'daily',  null::integer, true,  1),
  ('zoon',      '30 min no-phone met mijn zoon',               'daily',  null::integer, false, 2),
  ('verklaren', 'Mezelf verklaren',                            'daily',  null::integer, false, 3),
  ('water',     'Enkel water (weekdagen)',                     'daily',  null::integer, false, 4),
  ('stappen',   '10.000 stappen',                              'daily',  null::integer, false, 5),
  ('sport',     'Sporten',                                     'weekly', 3,             false, 6),
  ('backtest',  'Backtesten',                                  'weekly', 4,             false, 7),
  ('vriendin',  'Intentionele avond met mijn partner',         'weekly', 1,             false, 8),
  ('mama',      'Mama bellen',                                 'weekly', 1,             false, 9)
) as d(key, label, tier, target, is_floor, ord)
on conflict (user_id, key) do nothing;
