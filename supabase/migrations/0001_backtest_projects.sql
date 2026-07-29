-- =========================================================
-- Beyen Invest — migration: backtest projects
-- Paste into Supabase SQL editor and run once on the existing project.
--
-- Adds isolated "backtest projects": a trade either belongs to the live
-- Journal (backtest_project_id IS NULL) or to exactly one backtest project
-- (backtest_project_id set) — never both, never shared across projects.
-- =========================================================

create table backtest_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  naam text not null,
  beschrijving text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table trades
  add column backtest_project_id uuid references backtest_projects(id) on delete cascade;

create index idx_trades_backtest_project on trades(backtest_project_id);

alter table backtest_projects enable row level security;

create policy "backtest_projects_owner_all" on backtest_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger trg_backtest_projects_updated_at before update on backtest_projects
  for each row execute function set_updated_at();
