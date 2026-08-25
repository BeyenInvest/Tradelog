-- 0050 — Per-journal opt-in for the advanced-analysis layer (Fase G-rest).
--
-- MAE/MFE, planned R:R and the SQN system-quality stat were previously beta-gated
-- (shown to every beta user, always). Owner decision (2026-08-25): make them an
-- opt-in that belongs to the journal — activated while building/editing a journal —
-- so the default trade form and KPI row stay clean and a trader deliberately turns
-- on the deeper analytics per book (a scalp journal may track excursions, a swing
-- journal may not).
--
-- One flag governs the whole module: the planned-RR/MAE/MFE fields in the trade
-- form, the Exit-analysis section in the Analyse tab, and the SQN KPI card. Default
-- false, so existing journals (and the owner's own) start off and must be activated.
-- The N3 data columns (0049) are untouched; this only gates their UI.

alter table methodologies
  add column if not exists track_exit boolean not null default false;

comment on column methodologies.track_exit is
  'Opt-in for the advanced-analysis layer (Fase G-rest): planned R:R + MAE/MFE fields, the exit-analysis view and the SQN KPI. Default off; toggled per journal in the builder / methodology editor.';
