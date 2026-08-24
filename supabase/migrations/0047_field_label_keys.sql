-- =========================================================
-- Beyen Invest — migration 0047: render-time veldlabel-vertaling (Fase G-rest, A3)
--
-- Probleem: de journal-builder schrijft veldlabels ("Marktconditie") en
-- groepskoppen ("Setup & uitvoering") vertaald-bij-aanmaak naar
-- methodology_fields.label / .group_label — frozen-at-creation. Een NL-aangemaakt
-- journal lekt dus Nederlands in de EN-UI (en andersom), voorgoed.
--
-- Structurele fix: twee nullable kolommen op methodology_fields.
--   * label_key  = de bouwsteen-key uit de client-catalogus (src/lib/fieldBlocks.ts,
--                  bv. 'market_condition'). De UI vertaalt bij render via
--                  t(`blocks.items.${label_key}.label`) en valt terug op de vrije
--                  `label` (custom velden, of een ooit uit de catalogus verwijderde key).
--   * group_key  = de bouwsteen-groep ('setup' | 'markt' | 'mindset'), zelfde
--                  mechaniek via t(`blocks.groups.${group_key}`), fallback group_label.
-- Vrije tekst blijft leidend: hernoemt de gebruiker een label of groepskop, dan
-- wist een trigger de bijbehorende key — hun eigen bewoording wint dan altijd,
-- in élke taal. Geen enkel client-schrijfpad hoeft daaraan te denken.
--
-- Verder: backfill voor bestaande rijen (alleen waar het bevroren label exact
-- een bekend catalogus/preset-label is — een al-hernoemd veld blijft onaangeroerd),
-- en de twee functies met een expliciete veldkolomlijst nemen de nieuwe kolommen
-- mee: fork_methodology (0024) kopieert ze, shared_methodology_fields (0042)
-- geeft ze door zodat ook de anonieme share-view in de kijker-taal vertaalt.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0047_field_label_keys.sql
-- Safe to re-run — idempotent.
-- =========================================================

-- ---------------------------------------------------------
-- 1. kolommen
-- ---------------------------------------------------------
-- Bewust vrije text zonder CHECK/FK: de catalogus leeft client-side en een nieuwe
-- bouwsteen mag nooit een migratie vereisen (zelfde filosofie als asset_class, 0022).
alter table methodology_fields add column if not exists label_key text;
alter table methodology_fields add column if not exists group_key text;

-- ---------------------------------------------------------
-- 2. trigger: hernoemen ontdooit het veld
-- ---------------------------------------------------------
-- Wijzigt een update de vrije tekst zonder zelf een nieuwe key mee te geven, dan
-- vervalt de key: vanaf dan rendert overal de eigen bewoording i.p.v. de
-- catalogus-vertaling. Dit vangt élk schrijfpad (Settings-editor, inline
-- veldbeheer in het tradeformulier, toekomstige paden) in één keer af.
create or replace function methodology_fields_clear_stale_keys()
returns trigger
language plpgsql
as $$
begin
  if new.label is distinct from old.label
     and new.label_key is not distinct from old.label_key then
    new.label_key := null;
  end if;
  if new.group_label is distinct from old.group_label
     and new.group_key is not distinct from old.group_key then
    new.group_key := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_methodology_fields_clear_stale_keys on methodology_fields;
create trigger trg_methodology_fields_clear_stale_keys
  before update on methodology_fields
  for each row execute function methodology_fields_clear_stale_keys();

-- ---------------------------------------------------------
-- 3. backfill label_key
-- ---------------------------------------------------------
-- Alleen waar field_key een catalogus-key is ÉN het bevroren label exact het
-- bekende geschreven label is (NL/EN blocks-i18n; de oude preset-seeds 0027/0028
-- schreven dezelfde NL-labels). Een veld dat de gebruiker ooit hernoemde matcht
-- niet en blijft dus — correct — bij zijn eigen bewoording. Preset-keys zonder
-- catalogus-equivalent (float, session_utc, management_notes, …) blijven bevroren:
-- daar bestaat geen vertaalsleutel voor.
update methodology_fields f
set label_key = f.field_key
from (values
  ('setup',            'Setup'),
  ('timeframe',        'Timeframe'),
  ('market_condition', 'Marktconditie'),
  ('market_condition', 'Market condition'),
  ('quality',          'Setup-kwaliteit'),
  ('quality',          'Setup quality'),
  ('direction_note',   'Richting'),
  ('direction_note',   'Direction'),
  ('session',          'Sessie'),
  ('session',          'Session'),
  ('news',             'High-impact nieuws?'),
  ('news',             'High-impact news?'),
  ('sector',           'Sector'),
  ('market_cap',       'Market cap'),
  ('catalyst',         'Katalysator'),
  ('catalyst',         'Catalyst'),
  ('contracts',        'Aantal contracten'),
  ('contracts',        'Contracts'),
  ('contract_type',    'Contracttype'),
  ('contract_type',    'Contract type'),
  ('hours',            'Handelsuren'),
  ('hours',            'Trading hours'),
  ('market_type',      'Markttype'),
  ('market_type',      'Market type'),
  ('leverage',         'Hefboom (x)'),
  ('leverage',         'Leverage (x)'),
  ('market_regime',    'Marktregime'),
  ('market_regime',    'Market regime'),
  ('targets',          'Targets (R)'),
  ('emotion',          'Emotie'),
  ('emotion',          'Emotion'),
  ('mistake',          'Fout'),
  ('mistake',          'Mistake'),
  ('followed_plan',    'Volgde ik mijn plan?'),
  ('followed_plan',    'Did I follow my plan?')
) as k(field_key, written_label)
where f.label_key is null
  and f.field_key = k.field_key
  and f.label = k.written_label;

-- ---------------------------------------------------------
-- 4. backfill group_key
-- ---------------------------------------------------------
-- Builder-koppen (NL/EN) + de korte koppen van de oude preset-seeds. De oude
-- preset-forks tonen hierna de vollere catalogus-kop ("Setup & uitvoering" i.p.v.
-- "Setup") — bewust: consistent met de nieuwe builder. 'Beheer' heeft geen
-- catalogus-groep en blijft bevroren.
update methodology_fields
set group_key = case
  when group_label in ('Setup & uitvoering', 'Setup & execution', 'Setup') then 'setup'
  when group_label in ('Markt', 'Market') then 'markt'
  when group_label in ('Mindset & discipline', 'Mindset') then 'mindset'
end
where group_key is null
  and group_label in ('Setup & uitvoering', 'Setup & execution', 'Setup',
                      'Markt', 'Market', 'Mindset & discipline', 'Mindset');

-- ---------------------------------------------------------
-- 5. fork_methodology: kopieer de nieuwe kolommen mee
-- ---------------------------------------------------------
-- Zelfde definitie als 0024 (security invoker, show_when-remap via field_key),
-- alleen label_key/group_key toegevoegd aan de kolomlijsten — anders zou een fork
-- van een vertaalbaar journal weer bevroren labels krijgen.
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

  -- 1. Copy the methodology as the caller's own (never a system template).
  insert into methodologies (user_id, naam, is_system, asset_class, instrument_config)
  select auth.uid(), naam, false, asset_class, instrument_config
  from methodologies
  where id = source_id
  returning id into new_id;

  if new_id is null then
    raise exception 'source methodology % not found or not visible', source_id;
  end if;

  -- 2. Copy the fields, minus the self-referential show_when_field_id for now.
  insert into methodology_fields
    (methodology_id, fase_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, null, field_key, label, label_key, field_type, options, is_computed,
         group_label, group_key, required, show_when_values, sort_order
  from methodology_fields
  where methodology_id = source_id;

  -- 3. Remap show_when_field_id: a copied field's condition should point at the
  --    copy of the same parent (matched by field_key, unique per methodology).
  update methodology_fields nf
  set show_when_field_id = np.id
  from methodology_fields sf
  join methodology_fields sp on sp.id = sf.show_when_field_id            -- source parent
  join methodology_fields np on np.methodology_id = new_id and np.field_key = sp.field_key  -- new parent
  where sf.methodology_id = source_id
    and nf.methodology_id = new_id
    and nf.field_key = sf.field_key;

  return new_id;
end;
$$;

revoke execute on function fork_methodology(uuid) from public, anon;
grant execute on function fork_methodology(uuid) to authenticated;

-- ---------------------------------------------------------
-- 6. shared_methodology_fields: geef de keys door aan de share-view
-- ---------------------------------------------------------
-- Zelfde allow-list als 0042 + label_key/group_key, zodat de anonieme
-- trade-detail-modal veldlabels in de taal van de kíjker rendert (met dezelfde
-- fallback naar de vrije label). Verder ongewijzigd.
create or replace function shared_methodology_fields(mid uuid, owner_id uuid)
returns jsonb
language sql
stable
as $$
  select coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'field_key', f.field_key,
        'label', f.label,
        'label_key', f.label_key,
        'field_type', f.field_type,
        'options', to_jsonb(f.options),
        'group_label', f.group_label,
        'group_key', f.group_key,
        'is_computed', f.is_computed,
        'sort_order', f.sort_order
      ) order by f.sort_order, f.field_key)
      from methodology_fields f
      join methodologies m on m.id = f.methodology_id
      where f.methodology_id = mid and m.user_id = owner_id
    ),
    '[]'::jsonb
  );
$$;

revoke all on function shared_methodology_fields(uuid, uuid) from public, anon, authenticated;

-- =========================================================
-- Verificatie (read-only):
--   select column_name from information_schema.columns
--     where table_name = 'methodology_fields' and column_name in ('label_key','group_key');  -- 2 rijen
--   select tgname from pg_trigger
--     where tgname = 'trg_methodology_fields_clear_stale_keys';                              -- 1 rij
--   select field_key, label, label_key, group_label, group_key
--     from methodology_fields where label_key is not null limit 10;   -- backfill zichtbaar (mits presets/forks bestaan)
--   -- trigger-gedrag: een label-update hoort label_key op null te zetten
--   --   (niet uitvoeren op echte data; ter illustratie)
--   select prosecdef from pg_proc where proname = 'fork_methodology';                        -- f (invoker)
--   select get_shared_journal('bestaat-niet');                                               -- null (nog steeds dicht)
-- =========================================================
