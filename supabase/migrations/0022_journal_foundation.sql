-- =========================================================
-- Beyen Invest — migration 0022: journal foundation (Scope C, cyclus 1b — plak 1)
--
-- Purely additive + one column rename. Widens the cyclus-0 methodology model
-- toward the "journal = methodiek + asset class" design (docs/ontwerp-configureerbaar-journal.md):
--   * methodologies gets asset_class + instrument_config -> it becomes the "journal"
--   * methodology_fields gains the generic custom-field attributes (field_type
--     widened to text/number/date; group_label; required; show_when_* for
--     conditional visibility, the generalisation of Weekly Phase Method's fase-conditional kenmerken)
--   * trades.kenmerken -> trades.custom (the flexible per-trade custom-value bag)
--
-- NO existing behaviour changes: useMethodology still reads methodology_fases and
-- the trade form/analysis still read the fixed fase*_ columns. The fase->field
-- conversion, new-user empty journal and journal_id scoping are later slices
-- (1b-ii / 1b-iii). Nothing is dropped.
--
-- Paste into the Supabase SQL editor and run once.
-- =========================================================

-- ---------- methodologies -> journal ----------
-- asset_class: forex | futures | stock | crypto | custom. Deliberately free text
-- (no CHECK) so adding a new asset preset never needs a migration. instrument_config:
-- the instrument universe + sizing tools per asset — populated in cyclus 7.
alter table methodologies add column asset_class text;
alter table methodologies add column instrument_config jsonb;

-- The built-in Weekly Phase Method template is a forex methodology.
update methodologies set asset_class = 'forex'
  where id = '00000000-0000-4000-8000-000000000001';

-- ---------- methodology_fields: generic custom-field attributes ----------
-- Widen field_type beyond boolean/enum. group_label = form section header;
-- required = mandatory on input; show_when_field_id + show_when_values = conditional
-- visibility (show this field only when another field's value is in show_when_values).
alter table methodology_fields drop constraint methodology_fields_field_type_check;
alter table methodology_fields add constraint methodology_fields_field_type_check
  check (field_type in ('boolean', 'enum', 'text', 'number', 'date'));

alter table methodology_fields add column group_label text;
alter table methodology_fields add column required boolean not null default false;
alter table methodology_fields add column show_when_field_id uuid references methodology_fields(id) on delete set null;
alter table methodology_fields add column show_when_values jsonb;

-- ---------- trades.kenmerken -> trades.custom ----------
-- The bag now holds ALL custom-field values (not just fase-kenmerken), keyed by
-- methodology_fields.field_key. Still not written by the app yet (cyclus 2/3).
alter table trades rename column kenmerken to custom;
