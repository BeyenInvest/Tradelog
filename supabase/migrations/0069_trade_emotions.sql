-- =========================================================
-- Beyen Invest — migration 0069: vast notitieblok "Emoties" per trade.
--
-- Waarom (owner-besluit 2026-10-26): één notitievak mengde technische en
-- mentale reflectie. Het bestaande `notes`-vak heet in de UI voortaan
-- "Technisch" (alleen een label — de kolom blijft `notes`, bestaande notities
-- staan er dus meteen onder) en er komt een tweede vast vak "Emoties" bij.
--
-- Wat: één nullable tekstkolom op trades. Geen backfill, geen check, geen
-- nieuwe policy (de bestaande per-user RLS op trades dekt elke kolom).
-- shared_trade_json blijft ongemoeid: de share-weergave toont geen notities,
-- en een mentale reflectie hoort al helemaal niet in een gedeelde link.
-- Idempotent (if not exists) zodat een herhaalde run geen kwaad kan.
-- =========================================================

alter table trades add column if not exists emotions text;

comment on column trades.emotions is
  'Vrij notitieblok "Emoties" (0069) — mentale reflectie naast notes ("Technisch").';
