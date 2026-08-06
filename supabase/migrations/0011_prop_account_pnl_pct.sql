-- =========================================================
-- Beyen Invest — migration: running P&L% on prop accounts
--
-- prop_accounts only tracked discrete payouts (withdrawals); there was no
-- way to record an account's current running P&L% between payouts. This
-- adds a nullable, manually-entered field — same "handmatig, geen live
-- koppeling" philosophy as the rest of the Accounts page (see
-- AccountsPage.tsx subtitle). No RLS change needed, existing
-- prop_accounts_owner_all / prop_accounts_admin_select policies already
-- cover the new column.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

alter table prop_accounts add column current_pnl_pct numeric(6,2);
