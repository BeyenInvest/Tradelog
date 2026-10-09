-- =========================================================
-- Beyen Invest — migration 0068: "Scale-in" standaard in elk journal.
--
-- Waarom (owner-besluit 2026-10-08): Scale-in is een vlag die elke trader
-- nodig heeft — het hoort er standaard te staan, naast "Gemiste trade" in het
-- TV-paneel en in het resultaat-blok van het web-formulier, zonder dat iemand
-- eerst in de veld-editor een veld moet aanmaken. 0066 gaf ja/nee-velden de
-- vakje-weergave; dit zet er één standaard in.
--
-- Wat:
--   1. Backfill: elk bestaand journal (ook de systeem-templates, zodat een fork
--      'm meekrijgt) krijgt een boolean-veld `scale_in` met checkbox = true,
--      achteraan in de volgorde, groep Setup, label_key = 'scale_in' (label
--      vertaalt via blocks.items.scale_in). Bestaat de sleutel al: niets.
--   2. handle_new_user(): het lege start-journal van een nieuwe signup krijgt
--      'm meteen mee.
--   3. create_journal(): (a) de "hergebruik het lege journal"-regel negeert het
--      standaardveld — anders telt het onboarding-journal niet meer als leeg en
--      blijft er een wees achter; (b) de builder-velden landen met on conflict
--      do nothing (een builder die zelf scale_in meestuurt botst niet met het
--      al aanwezige standaardveld) en nemen nu ook `checkbox` mee (0066 had de
--      kolom, de RPC schreef 'm nog niet); (c) daarna wordt scale_in
--      gegarandeerd en achteraan gezet.
--   Wie het veld niet wil, verwijdert het in de veld-editor — er is geen
--   trigger die het terugzet. fork_methodology kopieert al alle velden incl.
--   checkbox (0066), dus daar verandert niets.
--
-- Body-conventie (0052-les): handle_new_user vertrekt van de 0035/0025-eindstand,
-- create_journal van de 0052-body — beide de laatste definities (= schema.sql).
--
-- Idempotent: alle inserts zijn on conflict do nothing; de functies zijn
-- create or replace.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0068_standard_scale_in.sql
-- =========================================================

-- ---------- 1. Backfill: elk journal krijgt Scale-in ----------
insert into methodology_fields
  (methodology_id, field_key, label, label_key, field_type, options,
   required, group_label, group_key, sort_order, checkbox)
select m.id, 'scale_in', 'Scale-in', 'scale_in', 'boolean', null,
       false, 'Setup', 'setup',
       coalesce((select max(f.sort_order) from methodology_fields f where f.methodology_id = m.id), 0) + 1,
       true
from methodologies m
on conflict (methodology_id, field_key) do nothing;

-- ---------- 2. Nieuwe signups: start-journal mét Scale-in ----------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_meth uuid;
begin
  insert into public.methodologies (user_id, naam, is_system, asset_class)
  values (new.id, 'Journal', false, null)
  returning id into new_meth;

  -- Standaardveld (0068): Scale-in als aanvinkvakje in elk journal.
  insert into public.methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options,
     required, group_label, group_key, sort_order, checkbox)
  values (new_meth, 'scale_in', 'Scale-in', 'scale_in', 'boolean', null,
          false, 'Setup', 'setup', 1, true)
  on conflict (methodology_id, field_key) do nothing;

  insert into public.profiles (id, email, display_name, methodology_id)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name', new_meth);
  return new;
end;
$$;

-- ---------- 3. create_journal: standaardveld respecteren + garanderen ----------
create or replace function create_journal(
  p_name text,
  p_fields jsonb,
  p_asset_class text,
  p_instrument_config jsonb,
  p_track_exit boolean,
  p_reuse_active_if_empty boolean
) returns uuid
language plpgsql
security invoker
as $$
declare
  uid uuid := auth.uid();
  target_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Onboarding/empty-state: hergebruik het actieve journal als dat je eigen,
  -- nog lege journal is (zelfde reuseActiveIfEmpty-regel die de client had) —
  -- zo blijft er geen leeg trigger-journal als wees achter. "Leeg" = geen
  -- velden behalve het standaardveld scale_in (0068).
  if p_reuse_active_if_empty then
    select m.id into target_id
    from profiles p
    join methodologies m on m.id = p.methodology_id
    where p.id = uid
      and m.user_id = uid
      and not m.is_system
      and not exists (
        select 1 from methodology_fields f
        where f.methodology_id = m.id and f.field_key <> 'scale_in'
      );
  end if;

  if target_id is not null then
    update methodologies
       set naam = p_name,
           asset_class = p_asset_class,
           instrument_config = p_instrument_config,
           track_exit = p_track_exit
     where id = target_id;
  else
    insert into methodologies (user_id, naam, is_system, asset_class, instrument_config, track_exit)
    values (uid, p_name, false, p_asset_class, p_instrument_config, p_track_exit)
    returning id into target_id;
  end if;

  insert into methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options,
     required, group_label, group_key, show_when_field_id, show_when_values, sort_order, checkbox)
  select target_id,
         ord.f->>'field_key',
         ord.f->>'label',
         ord.f->>'label_key',
         ord.f->>'field_type',
         nullif(ord.f->'options', 'null'::jsonb),
         coalesce((ord.f->>'required')::boolean, false),
         ord.f->>'group_label',
         ord.f->>'group_key',
         (ord.f->>'show_when_field_id')::uuid,
         nullif(ord.f->'show_when_values', 'null'::jsonb),
         ord.n::int,
         coalesce((ord.f->>'checkbox')::boolean, false)
  from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) with ordinality as ord(f, n)
  on conflict (methodology_id, field_key) do nothing;

  -- Standaardveld (0068): Scale-in gegarandeerd, achteraan in de volgorde.
  insert into methodology_fields
    (methodology_id, field_key, label, label_key, field_type, options,
     required, group_label, group_key, sort_order, checkbox)
  values (target_id, 'scale_in', 'Scale-in', 'scale_in', 'boolean', null,
          false, 'Setup', 'setup', 0, true)
  on conflict (methodology_id, field_key) do nothing;

  update methodology_fields
     set sort_order = coalesce((
           select max(o.sort_order) from methodology_fields o
           where o.methodology_id = target_id and o.field_key <> 'scale_in'
         ), 0) + 1
   where methodology_id = target_id and field_key = 'scale_in';

  update profiles set methodology_id = target_id where id = uid;

  return target_id;
end;
$$;

revoke execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) from public, anon;
grant execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) to authenticated;

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0068_standard_scale_in.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- elk journal heeft Scale-in als vakje (verwacht: 0):
--   select count(*) from methodologies m
--    where not exists (select 1 from methodology_fields f
--                       where f.methodology_id = m.id and f.field_key = 'scale_in' and f.checkbox);
--   -- de nieuwe functies dragen het standaardveld (verwacht: 2× true):
--   select proname, prosrc like '%scale_in%' from pg_proc
--    where proname in ('handle_new_user', 'create_journal');
-- =========================================================
