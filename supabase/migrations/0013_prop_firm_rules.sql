-- =========================================================
-- Beyen Invest — migration: prop-firm rules on prop_accounts
--
-- Adds the three classic prop-firm pass/fail thresholds an evaluation or funded
-- account is bound by, each expressed as a % of account size:
--   * profit_target_pct    — the profit needed to pass / get paid  (e.g. 8)
--   * max_drawdown_pct     — max total loss before the account blows (e.g. 10)
--   * daily_loss_limit_pct — max loss within a single day           (e.g. 5)
--
-- All three are nullable, manually entered, NON-INTRUSIVE — exactly the same
-- "handmatig, geen live koppeling" philosophy as current_pnl_pct (migration
-- 0011): a NULL means "rule not configured" and the UI simply omits it. Nothing
-- here reads trades; profit-target and max-drawdown progress is computed purely
-- against the account's manually-entered current_pnl_pct
-- (see computePropFirmStatus in src/lib/stats/propFirm.ts).
--
-- CHECK (... > 0): a threshold of zero or negative is meaningless (it would make
-- an account instantly passed or instantly blown), and the form validates > 0
-- before writing. No RLS change needed — existing prop_accounts_owner_all /
-- prop_accounts_admin_select policies already cover the new columns.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table prop_accounts add column profit_target_pct    numeric(6,2) check (profit_target_pct > 0);
alter table prop_accounts add column max_drawdown_pct      numeric(6,2) check (max_drawdown_pct > 0);
alter table prop_accounts add column daily_loss_limit_pct  numeric(6,2) check (daily_loss_limit_pct > 0);
