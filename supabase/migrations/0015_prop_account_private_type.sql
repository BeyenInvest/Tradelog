-- =========================================================
-- Beyen Invest — migration: "Private" account type
--
-- prop_accounts.fase (prop_fase_enum) only covered prop-firm challenge stages
-- (Phase 1 / Phase 2 / Funded). Adds "Private" for a personal (own-capital)
-- account so it can be tracked alongside prop-firm accounts. The UI relabels
-- this field from "Fase" to "Type" (display-only — the column stays `fase`);
-- only the "Private" value is shown translated (NL "Privé"), the prop-firm
-- jargon stays literal. See propAccountTypeLabel in src/lib/constants.ts.
--
-- ADD VALUE IF NOT EXISTS is idempotent and safe to re-run. Note: adding an
-- enum value cannot run inside a transaction block — paste and run this
-- statement on its own in the Supabase SQL editor.
-- =========================================================

alter type prop_fase_enum add value if not exists 'Private';
