-- =========================================================
-- Beyen Invest — migration 0028: add Forex & Crypto scalper presets (Scope C, cyclus 6)
--
-- Follow-up to 0027: the recommended startset had a scalper recipe for futures
-- only, but scalping is one of the most common styles in forex and crypto too.
-- Adds two more is_system recipes (asset preset ∪ Scalper style §5.2 = setup +
-- fast timeframes + emotion). Purely additive; existing presets/forks untouched.
--
-- Re-runnable: deletes just these two fixed ids first (cascading their fields).
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0028_scalper_presets.sql
-- =========================================================

delete from methodologies where id in (
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000042'
);

insert into methodologies (id, user_id, naam, is_system, asset_class, instrument_config) values
  ('00000000-0000-4000-8000-000000000012', null, 'Forex — Scalper',  true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000042', null, 'Crypto — Scalper', true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb);

insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, show_when_values, sort_order)
select
  v.methodology_id::uuid, null, v.field_key, v.label, v.field_type, v.options, false, v.group_label, false, v.show_when_values, v.sort_order
from (values
  -- === Forex — Scalper (…012) ===
  ('00000000-0000-4000-8000-000000000012','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000012','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000012','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000012','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000012','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,5),

  -- === Crypto — Scalper (…042) — leverage/funding_rate conditional on market_type (set below) ===
  ('00000000-0000-4000-8000-000000000042','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000042','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000042','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000042','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,4),
  ('00000000-0000-4000-8000-000000000042','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,5),
  ('00000000-0000-4000-8000-000000000042','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000042','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,7)
) as v(methodology_id, field_key, label, field_type, options, group_label, show_when_values, sort_order);

update methodology_fields child
set show_when_field_id = parent.id
from methodology_fields parent
where parent.methodology_id = child.methodology_id
  and parent.field_key = 'market_type'
  and child.field_key in ('leverage', 'funding_rate')
  and child.methodology_id = '00000000-0000-4000-8000-000000000042';
