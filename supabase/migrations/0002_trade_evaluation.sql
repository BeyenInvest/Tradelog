-- =========================================================
-- Beyen Invest — migration: trade evaluation
-- Paste into Supabase SQL editor and run once on the existing project.
--
-- Adds a self-assessment field to trades: "Good trade" / "Emotional error" /
-- "Technical error" — separate from outcome (Win/Loss/BE, the P&L result).
-- =========================================================

create type trade_evaluation_enum as enum ('Good trade','Emotional error','Technical error');

alter table trades
  add column trade_evaluation trade_evaluation_enum;
