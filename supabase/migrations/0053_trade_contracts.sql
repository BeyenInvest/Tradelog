-- =========================================================
-- Beyen Invest — migration 0053: trade contracts (owner-only pre-trade commitment)
--
-- A pre-trade commitment tool: the trader signs a short contract BEFORE taking
-- a trade (keystone-check, fase, instrument, risk, news window, signature). The
-- row is later closed with the outcome (in R) + whether the process was
-- respected, or logged as a deliberately missed setup. Owner-only in the UI
-- (gated on betaFeatures / useAuth), but scoped per-user + per-journal in the
-- DB exactly like weekly_reviews — no separate role system.
--
-- No P&L / money is stored — outcome is an R-multiple only, on purpose.
--
-- Mirrors the weekly_reviews / periodic_reviews conventions 1:1:
--   * id uuid default gen_random_uuid()
--   * user_id uuid not null default auth.uid() references auth.users on delete cascade
--   * methodology_id nullable, references methodologies on delete set null (per-journal)
--   * RLS on, one owner `for all` policy + the admin read-only carve-out (to authenticated)
-- No updated_at column (a contract is signed once, then closed once) → no
-- set_updated_at trigger, unlike the review tables.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- =========================================================

create table if not exists trade_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Which journal this contract belongs to (per-journal isolation, cyclus 3b).
  -- Nullable + on delete set null, mirroring weekly_reviews.methodology_id.
  methodology_id uuid references methodologies(id) on delete set null,
  created_at timestamptz not null default now(),
  -- When the contract was actually signed (status 'open'/'closed'); null for a
  -- deliberately missed setup (status 'missed'), which is never signed.
  signed_at timestamptz,
  instrument text,
  -- Free text ("F2"/"F3" in the owner's UI) — kept free like trades.fase, not a
  -- methodology fase name (this is an owner-only commitment tool).
  fase text,
  entry_type text,
  risk_pct numeric,
  signature text,
  status text not null default 'open' check (status in ('open', 'closed', 'missed')),
  -- Outcome as an R-multiple only — deliberately no money/P&L (see header).
  outcome_r numeric,
  proces_goed boolean,
  note text
);

create index if not exists idx_trade_contracts_user on trade_contracts(user_id);
create index if not exists idx_trade_contracts_methodology on trade_contracts(methodology_id);

alter table trade_contracts enable row level security;

-- Per-user owner policy (select/insert/update/delete), identical style to
-- weekly_reviews_owner_all / periodic_reviews_owner_all.
drop policy if exists "trade_contracts_owner_all" on trade_contracts;
create policy "trade_contracts_owner_all" on trade_contracts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin read-only carve-out (0046-patroon): `to authenticated` so anon never
-- evaluates is_admin() (see 0036).
drop policy if exists "trade_contracts_admin_select" on trade_contracts;
create policy "trade_contracts_admin_select" on trade_contracts
  for select to authenticated using (is_admin());

-- =========================================================
-- Read-only verification (run manually after the migration):
--   select count(*) from information_schema.tables where table_name = 'trade_contracts';  -- 1
--   select polname from pg_policies where tablename = 'trade_contracts';
--     -- trade_contracts_owner_all / trade_contracts_admin_select
--   select relrowsecurity from pg_class where relname = 'trade_contracts';                -- t
-- =========================================================
