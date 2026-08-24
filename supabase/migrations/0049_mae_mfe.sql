-- =========================================================
-- Beyen Invest — migration 0049: MAE/MFE + planned R:R (Fase N3, exit-analyse)
--
-- Three optional, hand-entered columns for exit analysis:
--
--   mae_pct     Maximum Adverse Excursion — the worst unrealized drawdown the
--               trade saw before it closed, as a POSITIVE magnitude in the same
--               unit as resultaat_pct (% of account). "Dipped to -0.8% before
--               recovering" → mae_pct = 0.8.
--   mfe_pct     Maximum Favorable Excursion — the best unrealized profit during
--               the trade, positive magnitude, % of account.
--   planned_rr  Planned reward:risk multiple at entry (the target in R),
--               e.g. 3 = a 3R target. Known before the trade closes.
--
-- All three are nullable — trades logged without them (all existing rows, quick-
-- log, imports: MetaTrader statements carry no excursion data) simply don't
-- take part in the exit stats (src/lib/stats/exit.ts skips nulls per metric).
-- No backfill needed or possible.
--
-- MAE/MFE describe the *finished* trade, so — mirroring trades_open_no_eval_chk
-- (0043) — an open trade may not carry them (planned_rr it may: that's the plan
-- made at entry, filled in while the trade still runs).
--
-- Deliberately NOT added to shared_trade_json (the share-RPC allow-list, 0042):
-- the share views don't render exit analysis, and the allow-list only grows
-- when a shared view actually needs a column.
--
-- Idempotent / re-runnable: add-column-if-not-exists (the inline checks ride
-- along on first add), constraint dropped-then-added.
--
-- Run: via de Supabase SQL Editor (of node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0049_mae_mfe.sql)
-- =========================================================

alter table trades add column if not exists mae_pct numeric(7,2) check (mae_pct >= 0);
alter table trades add column if not exists mfe_pct numeric(7,2) check (mfe_pct >= 0);
alter table trades add column if not exists planned_rr numeric(7,2) check (planned_rr > 0);

-- A running trade has no final excursions yet — keep them null until close, so
-- a reopened trade can't carry stale MAE/MFE into the exit stats when it later
-- closes with different numbers. (The form nulls them too; this is the same
-- belt-and-braces the 0043 evaluation check gives trade_evaluation.)
alter table trades drop constraint if exists trades_open_no_excursion_chk;
alter table trades add constraint trades_open_no_excursion_chk check (
  not is_open or (mae_pct is null and mfe_pct is null)
);

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   select column_name, data_type, is_nullable from information_schema.columns
--     where table_name = 'trades' and column_name in ('mae_pct','mfe_pct','planned_rr');
--   -- alle drie aanwezig, numeric, nullable; bestaande rijen blijven null:
--   select count(*) filter (where mae_pct is not null) as met_mae,
--          count(*) filter (where mfe_pct is not null) as met_mfe,
--          count(*) filter (where planned_rr is not null) as met_plan,
--          count(*) as totaal
--   from trades;
--   -- constraint actief (0 rijen):
--   select id from trades where is_open and (mae_pct is not null or mfe_pct is not null);
-- =========================================================
