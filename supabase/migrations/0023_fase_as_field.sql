-- =========================================================
-- Beyen Invest — migration 0023: fase becomes a field (Scope C, cyclus 1b — plak 2a)
--
-- Reseeds the Archer template's methodology_fields into the unified flat model
-- from the design (docs/ontwerp-configureerbaar-journal.md §2.4/§3):
--   * a 'fase' enum field (options = the 4 fase names) becomes the source of the
--     fase list — "fase is just a field". methodology_fases is KEPT for now
--     (useMethodology still reads it until plak 2b), so behaviour is unchanged.
--   * the 9 fase-scoped kenmerk rows collapse to 7 distinct fields keyed by
--     field_key, each shown conditionally via show_when_field_id + show_when_values
--     (e.g. 'daily_respecteert_zone' shows for Fase 1 & 2, 'structuur' for 2 & 3).
--     This matches how trades.custom already stores unified keys (verified: the
--     6 distinct custom keys have no fase prefix).
--
-- Nothing in the app reads methodology_fields yet, and methodology_fases + the
-- fixed fase*_ columns are untouched, so this changes NO behaviour. trades are
-- not touched. Atomic: the runner wraps this in a single transaction.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0023_fase_as_field.sql
-- =========================================================

-- Fields no longer belong to a fase: relax the FK column + swap the uniqueness
-- from (methodology_id, fase_id, field_key) to (methodology_id, field_key).
alter table methodology_fields alter column fase_id drop not null;
alter table methodology_fields drop constraint methodology_fields_methodology_id_fase_id_field_key_key;
delete from methodology_fields where methodology_id = '00000000-0000-4000-8000-000000000001';
alter table methodology_fields add constraint methodology_fields_methodology_id_field_key_key
  unique (methodology_id, field_key);

-- Reseed: the 'fase' enum field first, then the 7 unified kenmerk fields, each
-- pointing at the fase field via show_when for conditional visibility.
with fase_field as (
  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, sort_order)
  values
    ('00000000-0000-4000-8000-000000000001', null, 'fase', 'Fase', 'enum',
     '["Fase 1","Fase 2","Fase 3","Fase 4"]'::jsonb, false, null, true, 1)
  returning id
)
insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, show_when_field_id, show_when_values, sort_order)
select
  '00000000-0000-4000-8000-000000000001', null,
  v.field_key, v.label, v.field_type, v.options, v.is_computed, 'Kenmerken', false,
  ff.id, v.show_when, v.sort_order
from fase_field ff, (values
  ('daily_respecteert_zone',    'Daily respecteert zone?',         'boolean', null::jsonb,                false, '["Fase 1","Fase 2"]'::jsonb, 2),
  ('spelers_verleden',          'Al spelers in verleden (W)?',     'boolean', null::jsonb,                false, '["Fase 1"]'::jsonb,          3),
  ('structuur',                 'Structuur',                       'enum',    '["Inner","Outer"]'::jsonb, false, '["Fase 2","Fase 3"]'::jsonb, 4),
  ('zone_min_2_touches',        'Zone met min. 2 vorige touches?', 'boolean', null::jsonb,                false, '["Fase 3"]'::jsonb,          5),
  ('engulfing_candle',          'Engulfing candle?',               'boolean', null::jsonb,                false, '["Fase 3"]'::jsonb,          6),
  ('beide',                     'Beide?',                          'boolean', null::jsonb,                true,  '["Fase 3"]'::jsonb,          7),
  ('weekly_bevestigingscandle', 'Weekly bevestigingscandle?',      'boolean', null::jsonb,                false, '["Fase 4"]'::jsonb,          8)
) as v(field_key, label, field_type, options, is_computed, show_when, sort_order);
