-- =========================================================
-- Beyen Invest — migration 0027: journal-presets catalogue (Scope C, cyclus 6)
--
-- Seeds the recipe catalogue from docs/journal-presets.md as is_system, world-
-- readable methodologies (journals). Each recipe = an asset preset (§4: instrument
-- unit + sizing tools + asset fields) ∪ a trader-style preset (§5: setup/quality/
-- mindset/beheer fields). A user picks a recipe in /settings ("Start from a
-- template"); the existing fork_methodology() RPC (0024) forks it into an editable
-- own copy and repoints profiles.methodology_id. Weekly Phase Method (0020) stays
-- one recipe among these; "Blanco" needs no seed (it is the empty own methodology
-- handle_new_user() already provisions, 0025).
--
-- Universal-core fields (datum/instrument/outcome/resultaat/risk/notes/screenshots/
-- trade_evaluation) are NOT seeded — they are real trades.* columns for everyone.
-- Only the per-recipe custom fields live here (written to trades.custom by the
-- dynamic form, cyclus 3). Setup enums ship with a small generic starter list so a
-- recipe works out of the box; the user edits them after forking.
--
-- Non-intrusive: additive seed of new is_system rows only. The owner + existing
-- users are untouched (they keep their own methodology_id). Re-runnable: the fixed
-- preset ids are deleted first (cascading their fields); user forks are independent
-- copies with their own ids, so they are never affected.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0027_journal_presets.sql
-- =========================================================

-- Re-runnable: drop the seeded presets (cascades methodology_fields) before reseeding.
-- Only the 8 fixed system ids below — never a user's forked copy (those have random ids).
delete from methodologies where id in (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000020',
  '00000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000030',
  '00000000-0000-4000-8000-000000000031',
  '00000000-0000-4000-8000-000000000040',
  '00000000-0000-4000-8000-000000000041'
);

-- ---------- the 8 recipe methodologies (journals) ----------
insert into methodologies (id, user_id, naam, is_system, asset_class, instrument_config) values
  ('00000000-0000-4000-8000-000000000010', null, 'Forex — Day trader',   true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000011', null, 'Forex — Swing',        true, 'forex',
     '{"unit":"lots","sizing_tools":["lot_calculator","currency_split"]}'::jsonb),
  ('00000000-0000-4000-8000-000000000020', null, 'Futures — Scalper',    true, 'futures',
     '{"unit":"contracts","sizing_tools":["tick_value"],"tick_values":{"ES":12.5,"NQ":5,"YM":5,"RTY":5,"CL":10,"GC":10,"MES":1.25,"MNQ":0.5}}'::jsonb),
  ('00000000-0000-4000-8000-000000000021', null, 'Futures — Day trader', true, 'futures',
     '{"unit":"contracts","sizing_tools":["tick_value"],"tick_values":{"ES":12.5,"NQ":5,"YM":5,"RTY":5,"CL":10,"GC":10,"MES":1.25,"MNQ":0.5}}'::jsonb),
  ('00000000-0000-4000-8000-000000000030', null, 'Stocks — Day trader',  true, 'stock',
     '{"unit":"shares"}'::jsonb),
  ('00000000-0000-4000-8000-000000000031', null, 'Stocks — Swing',       true, 'stock',
     '{"unit":"shares"}'::jsonb),
  ('00000000-0000-4000-8000-000000000040', null, 'Crypto — Day trader',  true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb),
  ('00000000-0000-4000-8000-000000000041', null, 'Crypto — Swing',       true, 'crypto',
     '{"unit":"coins","note":"24/7"}'::jsonb);

-- ---------- fields (all optional; conditions on crypto set afterwards) ----------
-- Columns: methodology_id, field_key, label, field_type, options, group_label, show_when_values, sort_order.
-- is_computed=false, fase_id=null, required=false for every preset field.
insert into methodology_fields
  (methodology_id, fase_id, field_key, label, field_type, options, is_computed, group_label, required, show_when_values, sort_order)
select
  v.methodology_id::uuid, null, v.field_key, v.label, v.field_type, v.options, false, v.group_label, false, v.show_when_values, v.sort_order
from (values
  -- === Forex — Day trader (…010) ===
  ('00000000-0000-4000-8000-000000000010','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000010','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000010','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000010','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000010','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000010','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000010','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000010','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,8),

  -- === Forex — Swing (…011) ===
  ('00000000-0000-4000-8000-000000000011','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000011','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000011','session','Sessie','enum','["Asia","London","New York","Overlap"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000011','news','High-impact nieuws?','boolean',null::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000011','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000011','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000011','catalyst','Katalysator','text',null::jsonb,'Beheer',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000011','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,8),

  -- === Futures — Scalper (…020) ===
  ('00000000-0000-4000-8000-000000000020','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000020','timeframe','Timeframe','enum','["1m","3m","5m"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000020','contracts','Aantal contracten','number',null::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000020','contract_type','Contracttype','enum','["Standard","Micro"]'::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000020','contract_month','Contractmaand','text',null::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000020','hours','Handelsuren','enum','["RTH","ETH"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000020','session','Sessie','enum','["Pre-market","Regular","Overnight"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000020','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,8),

  -- === Futures — Day trader (…021) ===
  ('00000000-0000-4000-8000-000000000021','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000021','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000021','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000021','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000021','contracts','Aantal contracten','number',null::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000021','contract_type','Contracttype','enum','["Standard","Micro"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000021','contract_month','Contractmaand','text',null::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000021','hours','Handelsuren','enum','["RTH","ETH"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000021','session','Sessie','enum','["Pre-market","Regular","Overnight"]'::jsonb,'Markt',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000021','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,10),
  ('00000000-0000-4000-8000-000000000021','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,11),

  -- === Stocks — Day trader (…030) ===
  ('00000000-0000-4000-8000-000000000030','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000030','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000030','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000030','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000030','sector','Sector','enum','["Tech","Healthcare","Financials","Energy","Consumer","Industrials","Materials","Utilities","Real Estate","Communications"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000030','market_cap','Market cap','enum','["Large","Mid","Small","Micro"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000030','float','Float','enum','["Laag","Middel","Hoog"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000030','catalyst','Katalysator','enum','["Earnings","FDA","Up/downgrade","Sectornieuws","Gap","Breakout","M&A","Geen"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000030','session','Sessie','enum','["Pre-market","Regular","After-hours"]'::jsonb,'Markt',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000030','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,10),
  ('00000000-0000-4000-8000-000000000030','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,11),

  -- === Stocks — Swing (…031) — swing's text `catalyst` dropped in favour of the richer stocks enum catalyst ===
  ('00000000-0000-4000-8000-000000000031','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000031','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000031','sector','Sector','enum','["Tech","Healthcare","Financials","Energy","Consumer","Industrials","Materials","Utilities","Real Estate","Communications"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000031','market_cap','Market cap','enum','["Large","Mid","Small","Micro"]'::jsonb,'Markt',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000031','float','Float','enum','["Laag","Middel","Hoog"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000031','catalyst','Katalysator','enum','["Earnings","FDA","Up/downgrade","Sectornieuws","Gap","Breakout","M&A","Geen"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000031','session','Sessie','enum','["Pre-market","Regular","After-hours"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000031','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000031','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000031','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,10),

  -- === Crypto — Day trader (…040) — leverage/funding_rate conditional on market_type (set below) ===
  ('00000000-0000-4000-8000-000000000040','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000040','timeframe','Timeframe','enum','["1m","5m","15m","1H"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000040','market_condition','Marktconditie','enum','["Trending","Ranging","Volatiel/nieuws"]'::jsonb,'Setup',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000040','quality','Setup-kwaliteit','enum','["A+","B","C","Off-plan"]'::jsonb,'Setup',null::jsonb,4),
  ('00000000-0000-4000-8000-000000000040','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,5),
  ('00000000-0000-4000-8000-000000000040','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,6),
  ('00000000-0000-4000-8000-000000000040','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,7),
  ('00000000-0000-4000-8000-000000000040','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000040','mistake','Fout','enum','["Geen","FOMO","Revenge","Oversized","Chased","Te vroeg","Te laat"]'::jsonb,'Mindset',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000040','emotion','Emotie','enum','["Kalm/gedisciplineerd","FOMO","Angst","Hebzucht","Revenge"]'::jsonb,'Mindset',null::jsonb,10),

  -- === Crypto — Swing (…041) ===
  ('00000000-0000-4000-8000-000000000041','setup','Setup','enum','["Breakout","Pullback","Reversal","Range","Trendcontinuatie"]'::jsonb,'Setup',null::jsonb,1),
  ('00000000-0000-4000-8000-000000000041','timeframe','Timeframe','enum','["1H","4H","Daily"]'::jsonb,'Setup',null::jsonb,2),
  ('00000000-0000-4000-8000-000000000041','market_type','Markttype','enum','["Spot","Perpetual","Futures"]'::jsonb,'Markt',null::jsonb,3),
  ('00000000-0000-4000-8000-000000000041','leverage','Hefboom (x)','number',null::jsonb,'Markt','["Perpetual","Futures"]'::jsonb,4),
  ('00000000-0000-4000-8000-000000000041','funding_rate','Funding rate %','number',null::jsonb,'Markt','["Perpetual"]'::jsonb,5),
  ('00000000-0000-4000-8000-000000000041','session_utc','Sessie (UTC)','enum','["Asia","Europe","US"]'::jsonb,'Markt',null::jsonb,6),
  ('00000000-0000-4000-8000-000000000041','market_regime','Marktregime','enum','["Bull","Bear","Sideways"]'::jsonb,'Markt',null::jsonb,7),
  ('00000000-0000-4000-8000-000000000041','targets','Targets (R)','text',null::jsonb,'Beheer',null::jsonb,8),
  ('00000000-0000-4000-8000-000000000041','catalyst','Katalysator','text',null::jsonb,'Beheer',null::jsonb,9),
  ('00000000-0000-4000-8000-000000000041','management_notes','Beheer-notities','text',null::jsonb,'Beheer',null::jsonb,10)
) as v(methodology_id, field_key, label, field_type, options, group_label, show_when_values, sort_order);

-- ---------- crypto conditional visibility: point leverage/funding_rate at their market_type field ----------
update methodology_fields child
set show_when_field_id = parent.id
from methodology_fields parent
where parent.methodology_id = child.methodology_id
  and parent.field_key = 'market_type'
  and child.field_key in ('leverage', 'funding_rate')
  and child.methodology_id in (
    '00000000-0000-4000-8000-000000000040',
    '00000000-0000-4000-8000-000000000041'
  );
