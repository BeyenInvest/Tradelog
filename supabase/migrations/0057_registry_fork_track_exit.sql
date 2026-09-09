-- =========================================================
-- Beyen Invest — migration 0057: migratie-registry + fork-track_exit-fix +
-- review_sections.updated_at-trigger (fixplan blok C2/C3).
--
-- Inhoud:
--   1. fork_methodology kopieert voortaan ook track_exit (0050-kolom). 0048
--      hercreëerde de functie zonder die kolom in de insert-lijst, waardoor
--      een fork van een journal met de advanced-analysis-opt-in die opt-in
--      stil verloor (exit-velden/SQN weg in de fork). Body = exact de
--      0048-eindstand + track_exit in beide kolomlijsten (bindende
--      vertrek-van-laatste-definitie-conventie uit 0052).
--   2. trg_review_sections_updated_at: de tabel (0048) heeft een
--      updated_at-kolom maar had nooit een trigger — elke edit liet
--      updated_at op de created_at-waarde staan (meta-audit §4.2).
--   3. schema_migrations-registry: scripts/run-migration.mjs registreert
--      voortaan elke gedraaide file en weigert dubbele runs. Backfill voor
--      0001–0056 (allemaal op prod gedraaid; het dubbele nummer 0020 zijn twee
--      verschillende bestandsnamen, dus twee rijen — geen conflict). Deze file
--      zelf wordt door de runner geregistreerd (of door de insert hieronder
--      als je dit via de SQL Editor draait — on conflict do nothing dekt
--      beide volgordes).
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0057_registry_fork_track_exit.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. fork_methodology: track_exit reist mee de fork in.
-- (create or replace; laatste vorige versie = 0048)
-- ---------------------------------------------------------
create or replace function fork_methodology(source_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config, track_exit)
  select auth.uid(), naam, false, asset_class, instrument_config, track_exit
  from methodologies where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, null, field_key, label, label_key, field_type, options, is_computed,
         group_label, group_key, required, show_when_values, sort_order
  from methodology_fields where methodology_id = source_id;

  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  -- N5 (0048): neem de configureerbare review-secties mee de fork in.
  insert into review_sections
    (methodology_id, review_kind, section_key, label, label_key, input_type, sort_order)
  select new_id, review_kind, section_key, label, label_key, input_type, sort_order
  from review_sections where methodology_id = source_id;

  return new_id;
end;
$$;

revoke all on function fork_methodology(uuid) from public, anon;
grant execute on function fork_methodology(uuid) to authenticated;

-- ---------------------------------------------------------
-- 2. review_sections.updated_at wordt eindelijk bijgehouden.
-- ---------------------------------------------------------
drop trigger if exists trg_review_sections_updated_at on review_sections;
create trigger trg_review_sections_updated_at before update on review_sections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- 3. Migratie-registry + backfill.
-- ---------------------------------------------------------
create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
revoke all on table schema_migrations from anon, authenticated;

insert into schema_migrations (filename) values
  ('0001_backtest_projects.sql'),
  ('0002_trade_evaluation.sql'),
  ('0003_missed_trade_and_periodic_reviews.sql'),
  ('0004_weekly_review_live_trades_only.sql'),
  ('0005_profiles.sql'),
  ('0006_delete_own_account.sql'),
  ('0007_periodic_review_extra_fields.sql'),
  ('0008_admin_role.sql'),
  ('0009_hide_fase.sql'),
  ('0010_custom_entries.sql'),
  ('0011_prop_account_pnl_pct.sql'),
  ('0012_risk_pct.sql'),
  ('0013_prop_firm_rules.sql'),
  ('0014_drop_tpfs.sql'),
  ('0015_prop_account_private_type.sql'),
  ('0016_project_trade_summaries.sql'),
  ('0017_trade_import_ref.sql'),
  ('0018_custom_trade_concepts.sql'),
  ('0019_timezone_sessions.sql'),
  ('0020_backfill_trades_on_review_insert.sql'),
  ('0020_configurable_methodology.sql'),
  ('0021_weekly_review_verhalen.sql'),
  ('0022_journal_foundation.sql'),
  ('0023_fase_as_field.sql'),
  ('0024_fork_methodology.sql'),
  ('0025_empty_journal_for_new_users.sql'),
  ('0026_rename_methodology.sql'),
  ('0027_journal_presets.sql'),
  ('0028_scalper_presets.sql'),
  ('0029_trade_direction.sql'),
  ('0030_journal_scoping.sql'),
  ('0031_fork_users_off_shared_template.sql'),
  ('0032_trade_instrument.sql'),
  ('0033_beta_features.sql'),
  ('0035_neutral_journal_name.sql'),
  ('0036_revoke_anon_execute.sql'),
  ('0037_result_unit.sql'),
  ('0038_revoke_anon_project_summaries.sql'),
  ('0039_screenshots_bucket.sql'),
  ('0040_share_links.sql'),
  ('0041_onboarded_at.sql'),
  ('0042_review_share_links.sql'),
  ('0043_open_trades.sql'),
  ('0044_audit_hardening.sql'),
  ('0045_rename_field_option.sql'),
  ('0046_admin_methodology_select.sql'),
  ('0047_field_label_keys.sql'),
  ('0048_review_sections.sql'),
  ('0049_mae_mfe.sql'),
  ('0050_methodology_track_exit.sql'),
  ('0051_tijd_open.sql'),
  ('0052_fix_review_share_open_trades.sql'),
  ('0053_trade_contracts.sql'),
  ('0054_habits.sql'),
  ('0055_daily_journal.sql'),
  ('0056_configurable_habits.sql'),
  ('0057_registry_fork_track_exit.sql')
on conflict (filename) do nothing;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   -- track_exit zit in de fork-insert (verwacht: true):
--   select prosrc like '%instrument_config, track_exit%' from pg_proc where proname = 'fork_methodology';
--   -- trigger bestaat (verwacht: 1 rij):
--   select tgname from pg_trigger where tgname = 'trg_review_sections_updated_at';
--   -- registry gevuld (verwacht: 57):
--   select count(*) from schema_migrations;
--   -- app-rollen kunnen er niet bij (verwacht: 0 rijen):
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'schema_migrations' and grantee in ('anon', 'authenticated');
--   -- functioneel: fork een journal met track_exit=true en check de kopie:
--   --   select naam, track_exit from methodologies where user_id = auth.uid() order by created_at desc limit 1;
-- =========================================================
