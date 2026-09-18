-- =========================================================
-- Beyen Invest — migration 0059: retire the hardcoded Weekly Phase Method (WPM)
-- fase system — "cyclus 10", now a greenlit big-bang (owner-besluit 2026-09-18).
--
-- WAT. De WPM-velden verhuizen van vaste trades.*-kolommen naar de flexibele
-- trades.custom-jsonb-bag, gekeyed op field_key, en elke methodology die een
-- `fase`-veld draagt (het is_system-template …0001 én elke user-fork ervan,
-- 0031/0057) krijgt het 11-velden-contract in methodology_fields. Daarna is
-- WPM een gewoon config-gedreven journal, precies als de ICT/SMC-startset —
-- geen speciale kolommen, geen fase_enum, geen hide_fase-toggle, geen
-- transitionele methodology_fases-tabel meer.
--
-- CONTRACT (field_key → type → group; sort_order = deze volgorde; allemaal
-- ONVOORWAARDELIJK — geen show_when; label_key = field_key, de app levert
-- catalogue-blokken met deze keys; group_key = 'setup' | 'markt'):
--    1 fase             enum    Setup  required; ["Fase 1".."Fase 4"]
--    2 weekly_criteria  enum    Setup  ["Pattern","High/Low","IC","Region"]
--    3 trade_concept    enum    Setup  TRADE_CONCEPTS + eigen custom_options + reeds opgeslagen waarden
--    4 entry            enum    Setup  ENTRIES + eigen custom_options + reeds opgeslagen waarden
--    5 w_confirm        boolean Setup
--    6 d_confirm        boolean Setup
--    7 h4_confirm       boolean Setup
--    8 extra_d_conf     boolean Setup
--    9 weekly_kenmerk   enum    Markt  ["Trending market","Corrective market","Ranging market"]
--   10 cc               enum    Markt  ["03","07","11","15","19","23"]
--   11 nieuws           boolean Markt
--
-- FASE-KENMERKEN VERVALLEN ALS VELD (owner-besluit 2026-09-17: globaal
-- verborgen via HIDE_FASE_KENMERKEN "tot nader order" — deze big-bang ís die
-- opruiming; conditionele show_when-velden passen bovendien niet in de
-- blok-gebaseerde startset). De 0023-rijen daily_respecteert_zone,
-- spelers_verleden, structuur, zone_min_2_touches, engulfing_candle,
-- weekly_bevestigingscandle en `beide` (computed) worden VERWIJDERD uit
-- methodology_fields. Hun historische DATA blijft wél bewaard: stap B kopieert
-- de kolomwaarden naar trades.custom onder diezelfde unified keys, zodat een
-- later opnieuw toegevoegd veld met die key de historie meteen terugvindt.
--
-- STAPPEN (één transactie — de runner wrapt; elke sanity-check RAISEt = alles terug):
--   A. methodology_fields op contract brengen voor élke methodology met een
--      fase-veld (ontbrekende velden inserten, bestaande ids/labels bewaren,
--      kenmerk-velden + `beide` verwijderen, sort_order).
--   B. Backfill trades.custom uit de vaste kolommen — de 11 contract-keys én
--      de 6 kenmerk-keys (alleen non-null; kolom WINT over een al aanwezige
--      custom-key — zie de toelichting bij B) + optie-lijsten van
--      entry/trade_concept aanvullen met custom_options én elke al opgeslagen
--      waarde, zodat elke waarde een geldige enum-optie is.
--   C. Verifiëren (rij-voor-rij gelijkheid kolom ⇔ custom) VÓÓR er iets wegvalt.
--   D. Sessie-trigger cc-loos maken, kolommen/index/enum-types droppen.
--   E. rename_field_option zonder fase-slot, share-RPC's zonder de gedropte
--      kolommen/hide_fase, profiles.hide_fase weg, methodology_fases +
--      methodology_fields.fase_id weg, fork_methodology zonder fase_id.
--
-- SESSIE (bewuste keuze). trades.sessie werd afgeleid uit tijd_open (0051) of
-- anders uit het cc-slot (0019). cc verdwijnt als kolom; de trigger valt nu
-- terug op custom->>'cc' (strikt "00".."23") en anders — alleen bij UPDATE — op
-- de bestaande waarde. Een nieuwe trade zonder tijd én zonder cc krijgt sessie
-- NULL, dus `sessie` wordt nullable. Voor WPM-trades is de uitkomst byte-voor-
-- byte gelijk (compute_sessie_at op cc:00 ≡ compute_sessie); voor niet-WPM
-- journals verdwijnt de fake "London" van het verborgen cc-default "11".
--
-- NIET AANGERAAKT: prop_fase_enum / prop_accounts.fase (account-"Type", losse
-- naamgenoot), custom_options-tabel (blijft staan tot de app 'm niet meer
-- leest; de waarden zijn in de optie-lijsten overgenomen), trade_contracts.
--
-- DEPLOY-VOLGORDE (0043-les, nu in beide richtingen): oude app + nieuwe DB
-- stuurt fase/cc als kolom → PostgREST weigert; nieuwe app + oude DB laat de
-- not-null fase/cc leeg → insert faalt. Migratie en app-deploy dus vlak na
-- elkaar draaien, in een rustig venster; maak vooraf een backup/PITR-punt.
--
-- ⚠️ ONOMKEERBAAR na commit: kolommen zijn weg. De data leeft door in
-- trades.custom; een omgekeerde migratie kan ze desnoods terugbouwen.
--
-- Idempotent: elke stap slaat over wat al gebeurd is (kolom-bestaat-checks,
-- if exists, not exists), dus een FORCE_RERUN is veilig.
--
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0059_retire_wpm_fase.sql
--
-- ---------------------------------------------------------
-- SECURITY REVIEW (Fable, 2026-09-18)
--   * Privileges: geen enkele nieuwe grant. Alle hergecreëerde functies houden
--     exact hun oude posture (revokes/grants worden idempotent herhaald):
--     share-RPC's blijven SECURITY DEFINER + search_path=public, anon-callable
--     alleen via token; shared_trade_json/shared_methodology_fields blijven
--     voor iedereen gerevoked (alleen de definer-RPC's roepen ze aan).
--   * Share-oppervlak KRIMPT: 20 top-level keys verdwijnen uit de allow-list
--     (fase, cc, confirms, kenmerken, fase3_beide, …). Dezelfde informatie
--     reisde al mee via 'custom' (in de allow-list sinds 0042), dus netto
--     geen nieuwe blootstelling; geen PII, geen prijzen (0058-besluit blijft).
--   * hide_fase: kolom weg ⇒ valt automatisch uit de kolom-grant van 0044;
--     de overige vijf self-service-kolommen blijven de enige schrijfbare.
--   * rename_field_option: het fase-slot vervalt, maar eigenaarschap
--     (own + not is_system, FOR UPDATE), enum-check, collision-check en de
--     RLS-gescopeerde trade-update blijven — een user kan nog steeds alleen
--     eigen journals/trades raken.
--   * Sessie-trigger leest custom->>'cc' (client-gestuurde jsonb): de cast
--     naar int gebeurt pas na een strikte regex ('^(0[0-9]|1[0-9]|2[0-3])$') in
--     een aparte CASE-tak, dus geen cast-error/DoS via een vreemde waarde.
--   * methodology_fases weg ⇒ de twee RLS-policies verdwijnen mee; niets in
--     src/ of api/ leest of schrijft de tabel (alleen commentaar).
--   * De backfill draait als DB-owner (bypasst RLS, nodig voor cross-user
--     werk) maar is strikt gescopeerd: alleen trades op een journal mét
--     fase-veld, plus verweesde (methodology_id null) trades van users die
--     zelf zo'n journal bezitten. Niets wordt verwijderd vóór stap C slaagt.
--   * Locks: ALTER TABLE trades neemt ACCESS EXCLUSIVE; lock_timeout 10s laat
--     de migratie fail-fast terugrollen i.p.v. app-verkeer op te stapelen.
--   * Geen dynamische SQL, geen EXECUTE met user-input, geen extensies.
-- =========================================================

-- Fail-fast op lock-contentie (deep-review 2026-09-17 §4): binnen de
-- runner-transactie geldt SET LOCAL tot de commit/rollback.
set local lock_timeout = '10s';
set local statement_timeout = '15min';

-- ---------------------------------------------------------
-- A. methodology_fields → het 11-velden-contract, per methodology met fase-veld
-- ---------------------------------------------------------
do $$
declare
  m record;
  v_meths int := 0;
  v_removed int;
  -- Contract-volgorde; array_position() geeft de sort_order.
  contract_keys text[] := array[
    'fase', 'weekly_criteria', 'trade_concept', 'entry',
    'w_confirm', 'd_confirm', 'h4_confirm', 'extra_d_conf',
    'weekly_kenmerk', 'cc', 'nieuws'];
begin
  for m in
    select f.methodology_id, f.id as fase_field_id, mm.user_id, mm.naam
    from methodology_fields f
    join methodologies mm on mm.id = f.methodology_id
    where f.field_key = 'fase'
    order by mm.is_system desc, mm.created_at
  loop
    v_meths := v_meths + 1;

    -- A1. De fase-kenmerk-velden (0023-seed) + het computed `beide` weg —
    --     zie de kop: globaal verborgen sinds 2026-09-17, en conditionele
    --     velden passen niet in de blok-startset. Hun data reist in stap B
    --     naar trades.custom en gaat dus NIET verloren.
    delete from methodology_fields
    where methodology_id = m.methodology_id
      and field_key in ('beide', 'daily_respecteert_zone', 'spelers_verleden', 'structuur',
                        'zone_min_2_touches', 'engulfing_candle', 'weekly_bevestigingscandle');
    get diagnostics v_removed = row_count;

    -- A2. De 10 velden die tot nu toe alleen als vaste kolom bestonden (2–11):
    --     inserten waar ze ontbreken. Bestaande rijen (bv. door een user zelf
    --     al aangemaakt onder dezelfde key) blijven onaangeroerd.
    insert into methodology_fields
      (methodology_id, field_key, label, label_key, field_type, options,
       is_computed, group_label, group_key, required, sort_order)
    select m.methodology_id, v.field_key, v.label, v.field_key, v.field_type, v.options,
           false, v.group_label, v.group_key, false, v.sort_order
    from (values
      ('weekly_criteria', 'Weekly criteria',          'enum',    '["Pattern","High/Low","IC","Region"]'::jsonb,                                                                          'Setup', 'setup',  2),
      ('trade_concept',   'Trade concept',            'enum',    '["Reversal","Continuation","Daily retrace","Pattern in Pattern","Push IC Push","Weekly-4H","Reclaim","Small daily pattern"]'::jsonb, 'Setup', 'setup', 3),
      ('entry',           'Entry',                    'enum',    '["Decel","Reversal","Continuation met ruimte","Continuation zonder ruimte","2H Entry","Reclaim","100 Fib","Instant limiet"]'::jsonb, 'Setup', 'setup', 4),
      ('w_confirm',       'Weekly richting mee?',     'boolean', null::jsonb,                                                                                                            'Setup', 'setup',  5),
      ('d_confirm',       'Daily richting mee?',      'boolean', null::jsonb,                                                                                                            'Setup', 'setup',  6),
      ('h4_confirm',      '4H richting mee?',         'boolean', null::jsonb,                                                                                                            'Setup', 'setup',  7),
      ('extra_d_conf',    'Extra Daily confirmatie?', 'boolean', null::jsonb,                                                                                                            'Setup', 'setup',  8),
      ('weekly_kenmerk',  'Weekly kenmerk',           'enum',    '["Trending market","Corrective market","Ranging market"]'::jsonb,                                                      'Markt', 'markt',  9),
      ('cc',              '4H Candle Close (CC)',     'enum',    '["03","07","11","15","19","23"]'::jsonb,                                                                               'Markt', 'markt', 10),
      ('nieuws',          'Nieuws nabij trade?',      'boolean', null::jsonb,                                                                                                            'Markt', 'markt', 11)
    ) as v(field_key, label, field_type, options, group_label, group_key, sort_order)
    where not exists (
      select 1 from methodology_fields x
      where x.methodology_id = m.methodology_id and x.field_key = v.field_key
    );

    -- A3. Het fase-veld zelf: groep Setup, required, geen conditie, label_key
    --     waar het label nog het geseede 'Fase' is (0047-regel: alleen
    --     catalogue-matches).
    update methodology_fields
    set group_label        = coalesce(group_label, 'Setup'),
        group_key          = coalesce(group_key, 'setup'),
        required           = true,
        show_when_field_id = null,
        show_when_values   = null,
        label_key          = case when label_key is null and label = 'Fase' then 'fase' else label_key end
    where id = m.fase_field_id;

    -- A4. sort_order: contract-velden 1..11 in contract-volgorde; alle andere
    --     (eigen) velden erachter, in hun huidige onderlinge volgorde.
    update methodology_fields f
    set sort_order = c.so
    from (
      select id,
             case when field_key = any(contract_keys)
                  then array_position(contract_keys, field_key)
                  else 11 + (row_number() over (
                         partition by (field_key = any(contract_keys))
                         order by sort_order, field_key))::int
             end as so
      from methodology_fields
      where methodology_id = m.methodology_id
    ) c
    where c.id = f.id
      and f.sort_order is distinct from c.so;

    raise notice '0059 A: methodology % (%; user %) op contract — % kenmerk-veld(en) verwijderd',
      m.methodology_id, m.naam, coalesce(m.user_id::text, 'system'), v_removed;
  end loop;

  raise notice '0059 A: % methodologies met fase-veld op het 11-velden-contract gebracht', v_meths;
end $$;

-- ---------------------------------------------------------
-- B. Backfill trades.custom uit de vaste kolommen
--
-- Scope = trades op een journal mét fase-veld (het template heeft sinds 0031
-- geen trades meer, maar hoort er formeel bij) + verweesde trades
-- (methodology_id null: journal verwijderd → on delete set null) van users die
-- zelf minstens één fase-journal bezitten. Niet-WPM-journals blijven buiten
-- schot: daar dragen fase/cc/nieuws alleen verborgen form-defaults.
--
-- De 6 kenmerk-keys (daily_respecteert_zone, spelers_verleden, structuur,
-- zone_min_2_touches, engulfing_candle, weekly_bevestigingscandle) gaan MEE de
-- bag in, ook al heeft geen veld ze meer (stap A1): pure data-preservatie.
--
-- Kolom WINT over een al aanwezige custom-key. Reden: 0020 kopieerde de
-- kenmerken ooit als snapshot in de bag, maar de legacy-form schreef sindsdien
-- uitsluitend naar de KOLOMMEN (LEGACY_TRADE_COLUMNS / isLockedLegacyField) —
-- de kolom is dus de waarheid die de user zag en bewerkte; de bag-kopie kan
-- stale zijn. Een key waarvoor de kolom null is, blijft staan (nooit wissen).
--
-- Kenmerk-paren (fase1/fase2 daily_respecteert_zone, fase2/fase3 structuur):
-- de kolom van de fase van de trade wint; anders coalesce in fase-volgorde.
-- Het aantal trades waar beide gevuld én verschillend zijn wordt gemeld.
-- ---------------------------------------------------------
do $$
declare
  v_scope int;
  v_orphans int;
  v_conflicts int;
  v_pairs int;
  v_updated int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'fase'
  ) then
    raise notice '0059 B: trades.fase bestaat niet meer — backfill al gedaan, overslaan';
    return;
  end if;

  create temp table wpm_scope on commit drop as
    select t.id
    from trades t
    where exists (
        select 1 from methodology_fields f
        where f.methodology_id = t.methodology_id and f.field_key = 'fase')
       or (t.methodology_id is null and exists (
        select 1 from methodology_fields f
        join methodologies m on m.id = f.methodology_id
        where m.user_id = t.user_id and f.field_key = 'fase'));
  create index on wpm_scope (id);

  select count(*) into v_scope from wpm_scope;
  select count(*) into v_orphans
    from trades t join wpm_scope s on s.id = t.id where t.methodology_id is null;
  select count(*) into v_pairs
    from trades t join wpm_scope s on s.id = t.id
    where (t.fase1_daily_respecteert_zone is not null and t.fase2_daily_respecteert_zone is not null
           and t.fase1_daily_respecteert_zone <> t.fase2_daily_respecteert_zone)
       or (t.fase2_structuur is not null and t.fase3_structuur is not null
           and t.fase2_structuur <> t.fase3_structuur);
  -- Bestaande custom-keys die door de kolomwaarde overschreven gaan worden
  -- (alleen de 11 directe kolommen — de kenmerk-snapshots uit 0020 zijn
  -- verwacht en niet interessant om te melden).
  select count(*) into v_conflicts
    from trades t join wpm_scope s on s.id = t.id
    where (t.custom ? 'fase' and t.custom ->> 'fase' is distinct from t.fase::text)
       or (t.weekly_criteria is not null and t.custom ? 'weekly_criteria' and t.custom ->> 'weekly_criteria' is distinct from t.weekly_criteria::text)
       or (t.weekly_kenmerk is not null and t.custom ? 'weekly_kenmerk' and t.custom ->> 'weekly_kenmerk' is distinct from t.weekly_kenmerk::text)
       or (nullif(t.trade_concept, '') is not null and t.custom ? 'trade_concept' and t.custom ->> 'trade_concept' is distinct from t.trade_concept)
       or (nullif(t.entry, '') is not null and t.custom ? 'entry' and t.custom ->> 'entry' is distinct from t.entry)
       or (t.custom ? 'cc' and t.custom ->> 'cc' is distinct from t.cc::text)
       or (t.w_confirm is not null and t.custom ? 'w_confirm' and t.custom -> 'w_confirm' is distinct from to_jsonb(t.w_confirm))
       or (t.d_confirm is not null and t.custom ? 'd_confirm' and t.custom -> 'd_confirm' is distinct from to_jsonb(t.d_confirm))
       or (t.h4_confirm is not null and t.custom ? 'h4_confirm' and t.custom -> 'h4_confirm' is distinct from to_jsonb(t.h4_confirm))
       or (t.extra_d_conf is not null and t.custom ? 'extra_d_conf' and t.custom -> 'extra_d_conf' is distinct from to_jsonb(t.extra_d_conf))
       or (t.custom ? 'nieuws' and t.custom -> 'nieuws' is distinct from to_jsonb(t.nieuws));

  raise notice '0059 B: scope = % trades (waarvan % verweesd/zonder journal); % afwijkende custom-keys worden door de kolom overschreven; % trades met een verschillend fase1/fase2- of fase2/fase3-kenmerkpaar (fase van de trade wint)',
    v_scope, v_orphans, v_conflicts, v_pairs;

  -- updated_at is historie, geen migratie-artefact: de stempel-trigger even uit.
  alter table trades disable trigger trg_trades_updated_at;

  update trades t
  set custom = coalesce(t.custom, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
    'fase',            t.fase::text,
    'weekly_criteria', t.weekly_criteria::text,
    'weekly_kenmerk',  t.weekly_kenmerk::text,
    'trade_concept',   nullif(t.trade_concept, ''),
    'entry',           nullif(t.entry, ''),
    'cc',              t.cc::text,
    'w_confirm',       t.w_confirm,
    'd_confirm',       t.d_confirm,
    'h4_confirm',      t.h4_confirm,
    'extra_d_conf',    t.extra_d_conf,
    'nieuws',          t.nieuws,
    'daily_respecteert_zone', case t.fase
      when 'Fase 2' then coalesce(t.fase2_daily_respecteert_zone, t.fase1_daily_respecteert_zone)
      else               coalesce(t.fase1_daily_respecteert_zone, t.fase2_daily_respecteert_zone) end,
    'spelers_verleden', t.fase1_spelers_verleden,
    'structuur', (case t.fase
      when 'Fase 3' then coalesce(t.fase3_structuur, t.fase2_structuur)
      else               coalesce(t.fase2_structuur, t.fase3_structuur) end)::text,
    'zone_min_2_touches',        t.fase3_zone_min_2_touches,
    'engulfing_candle',          t.fase3_engulfing_candle,
    'weekly_bevestigingscandle', t.fase4_weekly_bevestigingscandle
  ))
  from wpm_scope s
  where s.id = t.id;
  get diagnostics v_updated = row_count;

  alter table trades enable trigger trg_trades_updated_at;

  raise notice '0059 B: % trades gebackfilld naar trades.custom', v_updated;
  if v_updated <> v_scope then
    raise exception '0059 B: backfill raakte % trades, scope was % — afgebroken', v_updated, v_scope;
  end if;
end $$;

-- B2. Optie-lijsten entry/trade_concept: de eigen custom_options van de user
--     (in aanmaakvolgorde) + elke al opgeslagen waarde op dit journal die nog
--     niet in de lijst zit. Zo is elke gebackfillde waarde een geldige optie en
--     verliest niemand zijn "+ eigen optie"-waarden. custom_options blijft
--     bestaan (de app leest 'm mogelijk nog); droppen = latere migratie.
do $$
declare
  r record;
  v_val text;
  v_opts jsonb;
  v_added int := 0;
  v_case_dupes int;
begin
  for r in
    select f.id, f.methodology_id, f.field_key, f.options, m.user_id
    from methodology_fields f
    join methodologies m on m.id = f.methodology_id
    where f.field_key in ('entry', 'trade_concept')
      and exists (
        select 1 from methodology_fields ff
        where ff.methodology_id = f.methodology_id and ff.field_key = 'fase')
  loop
    v_opts := coalesce(r.options, '[]'::jsonb);
    for v_val in
      select x.value from (
        select co.value, 1 as grp, co.created_at::text as ord
        from custom_options co
        where co.user_id = r.user_id and co.field = r.field_key
        union all
        select distinct t.custom ->> r.field_key, 2, t.custom ->> r.field_key
        from trades t
        where t.methodology_id = r.methodology_id and t.custom ? r.field_key
      ) x
      where x.value is not null and x.value <> ''
      order by x.grp, x.ord
    loop
      if not (v_opts ? v_val) then
        v_opts := v_opts || to_jsonb(v_val);
        v_added := v_added + 1;
      end if;
    end loop;
    if v_opts is distinct from r.options then
      update methodology_fields set options = v_opts where id = r.id;
    end if;
  end loop;

  -- Hoofdletter-varianten in één lijst zijn geldig maar hinderen later
  -- rename_field_option (case-insensitive collision-check) — alleen melden.
  select count(*) into v_case_dupes
  from methodology_fields f
  where f.field_key in ('entry', 'trade_concept')
    and f.options is not null
    and (select count(distinct lower(o)) from jsonb_array_elements_text(f.options) o) < jsonb_array_length(f.options);

  raise notice '0059 B2: % extra opties toegevoegd aan entry/trade_concept-lijsten; % veld(en) met hoofdletter-varianten in de lijst', v_added, v_case_dupes;
end $$;

-- ---------------------------------------------------------
-- C. Verificatie VÓÓR er iets wegvalt — rij-voor-rij: elke non-null kolomwaarde
--    staat exact zo (type-getrouw) in custom; en elke opgeslagen enum-waarde is
--    een optie van het veld van het journal. Faalt er één, dan rolt alles terug.
-- ---------------------------------------------------------
do $$
declare
  v_scope int;
  v_missing_fase int;
  v_mismatch int;
  v_bad_enum int;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'fase'
  ) then
    raise notice '0059 C: kolommen al weg — verificatie overgeslagen';
    return;
  end if;

  select count(*) into v_scope from wpm_scope;

  -- C1. Elke trade in scope heeft custom.fase (fase-kolom is not null).
  select count(*) into v_missing_fase
  from trades t join wpm_scope s on s.id = t.id
  where not (t.custom ? 'fase');
  if v_missing_fase > 0 then
    raise exception '0059 C1: % van % trades in scope missen custom.fase — afgebroken', v_missing_fase, v_scope;
  end if;

  -- C2. Rij-voor-rij gelijkheid kolom ⇔ custom voor alle 17 keys.
  select count(*) into v_mismatch
  from trades t join wpm_scope s on s.id = t.id
  where t.custom ->> 'fase' is distinct from t.fase::text
     or t.custom ->> 'cc'   is distinct from t.cc::text
     or t.custom -> 'nieuws' is distinct from to_jsonb(t.nieuws)
     or (t.weekly_criteria is not null and t.custom ->> 'weekly_criteria' is distinct from t.weekly_criteria::text)
     or (t.weekly_kenmerk  is not null and t.custom ->> 'weekly_kenmerk'  is distinct from t.weekly_kenmerk::text)
     or (nullif(t.trade_concept, '') is not null and t.custom ->> 'trade_concept' is distinct from t.trade_concept)
     or (nullif(t.entry, '')         is not null and t.custom ->> 'entry'         is distinct from t.entry)
     or (t.w_confirm    is not null and t.custom -> 'w_confirm'    is distinct from to_jsonb(t.w_confirm))
     or (t.d_confirm    is not null and t.custom -> 'd_confirm'    is distinct from to_jsonb(t.d_confirm))
     or (t.h4_confirm   is not null and t.custom -> 'h4_confirm'   is distinct from to_jsonb(t.h4_confirm))
     or (t.extra_d_conf is not null and t.custom -> 'extra_d_conf' is distinct from to_jsonb(t.extra_d_conf))
     or (t.fase1_spelers_verleden           is not null and t.custom -> 'spelers_verleden'          is distinct from to_jsonb(t.fase1_spelers_verleden))
     or (t.fase3_zone_min_2_touches         is not null and t.custom -> 'zone_min_2_touches'        is distinct from to_jsonb(t.fase3_zone_min_2_touches))
     or (t.fase3_engulfing_candle           is not null and t.custom -> 'engulfing_candle'          is distinct from to_jsonb(t.fase3_engulfing_candle))
     or (t.fase4_weekly_bevestigingscandle  is not null and t.custom -> 'weekly_bevestigingscandle' is distinct from to_jsonb(t.fase4_weekly_bevestigingscandle))
     or (coalesce(t.fase1_daily_respecteert_zone, t.fase2_daily_respecteert_zone) is not null
         and t.custom -> 'daily_respecteert_zone' is distinct from to_jsonb(case t.fase
               when 'Fase 2' then coalesce(t.fase2_daily_respecteert_zone, t.fase1_daily_respecteert_zone)
               else               coalesce(t.fase1_daily_respecteert_zone, t.fase2_daily_respecteert_zone) end))
     or (coalesce(t.fase2_structuur, t.fase3_structuur) is not null
         and t.custom ->> 'structuur' is distinct from (case t.fase
               when 'Fase 3' then coalesce(t.fase3_structuur, t.fase2_structuur)
               else               coalesce(t.fase2_structuur, t.fase3_structuur) end)::text);
  if v_mismatch > 0 then
    raise exception '0059 C2: % trades waar custom niet exact de kolomwaarden draagt — afgebroken', v_mismatch;
  end if;

  -- C3. Elke opgeslagen enum-waarde is een optie van het veld van het journal
  --     (verweesde trades hebben geen journal/veld en vallen hier buiten; de
  --     kenmerk-keys hebben geen veld meer en worden dus niet gecheckt).
  select count(*) into v_bad_enum
  from trades t
  join wpm_scope s on s.id = t.id
  join methodology_fields f on f.methodology_id = t.methodology_id
  where f.field_type = 'enum'
    and f.field_key in ('fase', 'weekly_criteria', 'weekly_kenmerk', 'trade_concept', 'entry', 'cc')
    and t.custom ? f.field_key
    and not (coalesce(f.options, '[]'::jsonb) ? (t.custom ->> f.field_key));
  if v_bad_enum > 0 then
    raise exception '0059 C3: % (trade, veld)-paren met een waarde buiten de optie-lijst — afgebroken', v_bad_enum;
  end if;

  raise notice '0059 C: verificatie OK — % trades, 0 mismatches, 0 waarden buiten hun optie-lijst', v_scope;
end $$;

-- ---------------------------------------------------------
-- D. Sessie zonder cc-kolom, dan de kolommen/index/types weg
-- ---------------------------------------------------------

-- D1. trades_set_sessie: tijd_open wint; anders custom->>'cc' (identiek aan
--     het oude compute_sessie: datum + cc uur, tz-bewust gebucket); anders bij
--     een UPDATE de bestaande waarde; bij een INSERT null.
create or replace function trades_set_sessie() returns trigger
language plpgsql as $$
declare
  v_tz text;
  v_cc text;
begin
  select timezone into v_tz from profiles where id = new.user_id;
  v_tz := coalesce(v_tz, 'Europe/Brussels');
  v_cc := new.custom ->> 'cc';

  if new.tijd_open is not null then
    new.sessie := compute_sessie_at(new.datum_open, new.tijd_open, v_tz);
  elsif v_cc ~ '^(0[0-9]|1[0-9]|2[0-3])$' then
    new.sessie := compute_sessie_at(new.datum_open, make_time(v_cc::int, 0, 0), v_tz);
  elsif tg_op = 'UPDATE' then
    new.sessie := old.sessie;
  else
    new.sessie := null;
  end if;
  return new;
end;
$$;

-- Kolomlijst wijzigt (cc → custom): drop-then-create. Moet vóór de kolom-drop,
-- anders blokkeert de trigger-afhankelijkheid het droppen van cc.
drop trigger if exists trg_trades_set_sessie on trades;
create trigger trg_trades_set_sessie
  before insert or update of datum_open, tijd_open, custom on trades
  for each row execute function trades_set_sessie();

-- D2. Tijdzone-wissel herberekent: tijd_open, anders custom.cc, anders laten staan.
create or replace function profiles_recompute_sessie() returns trigger
language plpgsql as $$
begin
  if new.timezone is distinct from old.timezone then
    update trades set sessie = case
      when tijd_open is not null then compute_sessie_at(datum_open, tijd_open, new.timezone)
      when (custom ->> 'cc') ~ '^(0[0-9]|1[0-9]|2[0-3])$'
        then compute_sessie_at(datum_open, make_time((custom ->> 'cc')::int, 0, 0), new.timezone)
      else sessie
    end
    where user_id = new.id;
  end if;
  return new;
end;
$$;

-- D3. compute_sessie(cc_enum, …) heeft geen aanroeper meer; weg vóór het type.
--     (drop function if exists met een niet-bestaand type faalt — vandaar de check.)
do $$
begin
  if exists (select 1 from pg_type where typname = 'cc_enum') then
    drop function if exists compute_sessie(cc_enum, date, text);
  end if;
end $$;

-- D4. sessie wordt nullable (zie kop): een trade zonder tijd én zonder cc heeft
--     geen sessie — geen fake "London" meer.
alter table trades alter column sessie drop not null;

-- D5. Index + kolommen. fase3_beide (generated) eerst, dan zijn basiskolommen.
drop index if exists idx_trades_fase;
alter table trades drop column if exists fase3_beide;
alter table trades
  drop column if exists fase,
  drop column if exists weekly_criteria,
  drop column if exists weekly_kenmerk,
  drop column if exists trade_concept,
  drop column if exists entry,
  drop column if exists cc,
  drop column if exists nieuws,
  drop column if exists w_confirm,
  drop column if exists d_confirm,
  drop column if exists h4_confirm,
  drop column if exists extra_d_conf,
  drop column if exists fase1_daily_respecteert_zone,
  drop column if exists fase1_spelers_verleden,
  drop column if exists fase2_daily_respecteert_zone,
  drop column if exists fase2_structuur,
  drop column if exists fase3_zone_min_2_touches,
  drop column if exists fase3_engulfing_candle,
  drop column if exists fase3_structuur,
  drop column if exists fase4_weekly_bevestigingscandle;

-- D6. Enum-types die nergens meer gebruikt worden. (prop_fase_enum, sessie_enum,
--     pair_enum, direction_enum, … blijven.) Geen CASCADE: een onverwachte
--     afhankelijkheid laat de migratie bewust falen.
drop type if exists fase_enum;
drop type if exists weekly_criteria_enum;
drop type if exists weekly_kenmerk_enum;
drop type if exists cc_enum;
drop type if exists structuur_enum;

-- ---------------------------------------------------------
-- E. Functies, hide_fase, methodology_fases
-- ---------------------------------------------------------

-- E1. rename_field_option zonder het fase-slot (fase is een gewoon enum-veld).
--     Body = 0045-eindstand minus de lock; verder ongewijzigd.
create or replace function rename_field_option(p_field_id uuid, p_old_value text, p_new_value text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_field methodology_fields%rowtype;
  v_new text := btrim(p_new_value);
  v_migrated integer := 0;
begin
  -- Lock the field row for the duration so two concurrent renames of the same
  -- field serialize instead of interleaving their option-list rewrites.
  select f.* into v_field
  from methodology_fields f
  join methodologies m on m.id = f.methodology_id
  where f.id = p_field_id
    and m.user_id = auth.uid()
    and not m.is_system
  for update of f;

  if not found then
    raise exception 'field not found or not editable' using errcode = 'P0002';
  end if;
  if v_field.field_type <> 'enum' or v_field.options is null or not (v_field.options ? p_old_value) then
    raise exception 'option not found' using errcode = 'P0002';
  end if;
  if v_new = '' or v_new = p_old_value then
    return 0;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(v_field.options) as o(val)
    where o.val <> p_old_value and lower(o.val) = lower(v_new)
  ) then
    raise exception 'option already exists' using errcode = '23505';
  end if;

  -- 1. The option list itself, position preserved.
  update methodology_fields
  set options = (
    select jsonb_agg(case when o.val = p_old_value then to_jsonb(v_new) else to_jsonb(o.val) end order by o.ord)
    from jsonb_array_elements_text(v_field.options) with ordinality as o(val, ord)
  )
  where id = p_field_id;

  -- 2. Sibling fields whose show_when condition references the old value —
  -- without this, a rename would silently break conditional visibility.
  update methodology_fields f
  set show_when_values = (
    select jsonb_agg(case when s.val = p_old_value then to_jsonb(v_new) else to_jsonb(s.val) end order by s.ord)
    from jsonb_array_elements_text(f.show_when_values) with ordinality as s(val, ord)
  )
  where f.show_when_field_id = p_field_id
    and f.show_when_values ? p_old_value;

  -- 3. Migrate stored answers: every trade of this journal holding the old
  -- value in its custom bag. One statement — no 1000-row pagination, no chunks.
  update trades t
  set custom = jsonb_set(t.custom, array[v_field.field_key], to_jsonb(v_new))
  where t.user_id = auth.uid()
    and t.methodology_id = v_field.methodology_id
    and t.custom ->> v_field.field_key = p_old_value;
  get diagnostics v_migrated = row_count;

  return v_migrated;
end;
$$;

revoke all on function rename_field_option(uuid, text, text) from public, anon;
grant execute on function rename_field_option(uuid, text, text) to authenticated;

-- E2. profiles.hide_fase weg (0009). Valt automatisch uit de kolom-grant van 0044.
alter table profiles drop column if exists hide_fase;

-- E3. Share-laag: allow-list zonder de gedropte kolommen; RPC's zonder hide_fase.
--     Bodies = schema.sql-eindstand (0052) minus die keys — bindende
--     "vertrek van de laatste definitie"-conventie.
create or replace function shared_trade_json(t trades)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', t.id,
    'datum_open', t.datum_open,
    'tijd_open', t.tijd_open,
    'datum_sluiting', t.datum_sluiting,
    'duur_dagen', t.duur_dagen,
    'is_open', t.is_open,
    'pair', t.pair,
    'instrument', t.instrument,
    'direction', t.direction,
    'outcome', t.outcome,
    'resultaat_pct', t.resultaat_pct,
    'risk_pct', t.risk_pct,
    'trade_evaluation', t.trade_evaluation,
    'sessie', t.sessie,
    'w_screenshot', case when t.w_screenshot ~* '^https?://' then t.w_screenshot end,
    'd_screenshot', case when t.d_screenshot ~* '^https?://' then t.d_screenshot end,
    'h4_screenshot', case when t.h4_screenshot ~* '^https?://' then t.h4_screenshot end,
    'h2_screenshot', case when t.h2_screenshot ~* '^https?://' then t.h2_screenshot end,
    'notes', t.notes,
    'weekly_review_id', t.weekly_review_id,
    'backtest_project_id', t.backtest_project_id,
    'methodology_id', t.methodology_id,
    'custom', t.custom,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  );
$$;

revoke all on function shared_trade_json(trades) from public, anon, authenticated;

create or replace function get_shared_journal(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'journal_name', m.naam,
    'display_name', p.display_name,
    'result_unit', p.result_unit,
    'fields', shared_methodology_fields(l.methodology_id, l.user_id),
    'trades', coalesce(
      (
        select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
        from trades t
        where t.user_id = l.user_id
          and t.backtest_project_id is null
          and t.methodology_id is not distinct from l.methodology_id
          and t.trade_evaluation is distinct from 'Missed trade'
          and not t.is_open
      ),
      '[]'::jsonb
    )
  )
  from share_links l
  join profiles p on p.id = l.user_id
  left join methodologies m on m.id = l.methodology_id and m.user_id = l.user_id
  where l.token = share_token
    and l.scope = 'journal'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke execute on function get_shared_journal(text) from public;
grant execute on function get_shared_journal(text) to anon, authenticated;

create or replace function get_shared_review(share_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when l.weekly_review_id is not null then
      (
        select jsonb_build_object(
          'kind', 'weekly',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'weekly'),
          'review', jsonb_build_object(
            'id', r.id,
            'week_nummer', r.week_nummer,
            'jaar', r.jaar,
            'titel', r.titel,
            'verhalen', r.verhalen,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment,
            'content', r.content
          ),
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.weekly_review_id = r.id
                and t.backtest_project_id is null
                and not t.is_open
                and t.methodology_id is not distinct from r.methodology_id
            ),
            '[]'::jsonb
          )
        )
        from weekly_reviews r
        where r.id = l.weekly_review_id and r.user_id = l.user_id
      )
    else
      (
        select jsonb_build_object(
          'kind', 'periodic',
          'journal_name', (select m.naam from methodologies m where m.id = r.methodology_id and m.user_id = l.user_id),
          'display_name', p.display_name,
          'result_unit', p.result_unit,
          'sections', shared_review_sections(r.methodology_id, l.user_id, 'periodic'),
          'review', jsonb_build_object(
            'id', r.id,
            'period_type', r.period_type,
            'jaar', r.jaar,
            'periode_nummer', r.periode_nummer,
            'titel', r.titel,
            'technisch', r.technisch,
            'mentaal_owner', r.mentaal_owner,
            'mentaal_trader', r.mentaal_trader,
            'acties', to_jsonb(r.acties),
            'takeaway', r.takeaway,
            'overall_comment', r.overall_comment,
            'periode_overzicht', r.periode_overzicht,
            'content', r.content
          ),
          -- Kalenderperiode identiek aan rangeOfPeriod() client-side
          -- (src/lib/periodRanges.ts): maand / kwartaal / jaar, inclusieve grenzen.
          'trades', coalesce(
            (
              select jsonb_agg(shared_trade_json(t) order by t.datum_open, t.id)
              from trades t
              where t.user_id = l.user_id
                and t.backtest_project_id is null
                and not t.is_open
                and t.methodology_id is not distinct from r.methodology_id
                and t.datum_open >= case r.period_type
                    when 'month' then make_date(r.jaar, r.periode_nummer, 1)
                    when 'quarter' then make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1)
                    else make_date(r.jaar, 1, 1)
                  end
                and t.datum_open <= case r.period_type
                    when 'month' then (make_date(r.jaar, r.periode_nummer, 1) + interval '1 month - 1 day')::date
                    when 'quarter' then (make_date(r.jaar, (r.periode_nummer - 1) * 3 + 1, 1) + interval '3 months - 1 day')::date
                    else make_date(r.jaar, 12, 31)
                  end
            ),
            '[]'::jsonb
          )
        )
        from periodic_reviews r
        where r.id = l.periodic_review_id and r.user_id = l.user_id
      )
  end
  from share_links l
  join profiles p on p.id = l.user_id
  where l.token = share_token
    and l.scope = 'review'
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke execute on function get_shared_review(text) from public;
grant execute on function get_shared_review(text) to anon, authenticated;

-- E4. methodology_fases (transitioneel sinds 0020/0023) + de fase_id-FK-kolom:
--     niets in src/ of api/ leest of schrijft ze nog (alleen commentaar en het
--     type MethodologyField.fase_id). Tabel-drop neemt policies + index mee.
alter table methodology_fields drop column if exists fase_id;
drop table if exists methodology_fases;

-- E5. fork_methodology zonder fase_id in de insert-lijst (body = 0057-eindstand).
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
    (methodology_id, field_key, label, label_key, field_type, options, is_computed,
     group_label, group_key, required, show_when_values, sort_order)
  select new_id, field_key, label, label_key, field_type, options, is_computed,
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

-- Registratie (runner doet dit ook; on conflict dekt de SQL-editor-route, 0057-conventie).
insert into schema_migrations (filename) values ('0059_retire_wpm_fase.sql')
on conflict do nothing;

-- =========================================================
-- Read-only verificatie (na het draaien):
--   -- 1. kolommen weg (verwacht: 0 rijen):
--   select column_name from information_schema.columns
--     where table_name = 'trades' and column_name in
--       ('fase','weekly_criteria','weekly_kenmerk','trade_concept','entry','cc','nieuws',
--        'w_confirm','d_confirm','h4_confirm','extra_d_conf','fase1_daily_respecteert_zone',
--        'fase1_spelers_verleden','fase2_daily_respecteert_zone','fase2_structuur',
--        'fase3_zone_min_2_touches','fase3_engulfing_candle','fase3_beide','fase3_structuur',
--        'fase4_weekly_bevestigingscandle');
--   -- 2. types weg (verwacht: alleen prop_fase_enum):
--   select typname from pg_type where typname in
--     ('fase_enum','weekly_criteria_enum','weekly_kenmerk_enum','cc_enum','structuur_enum','prop_fase_enum');
--   -- 3. elk fase-journal draagt exact de 11 contract-velden, geen kenmerk-/beide-veld,
--   --    en geen show_when meer op de contract-velden:
--   select m.naam, m.user_id,
--          count(*) filter (where f.field_key in ('beide','daily_respecteert_zone','spelers_verleden','structuur',
--            'zone_min_2_touches','engulfing_candle','weekly_bevestigingscandle')) as kenmerken,
--          count(*) filter (where f.field_key in ('fase','weekly_criteria','trade_concept','entry','w_confirm',
--            'd_confirm','h4_confirm','extra_d_conf','weekly_kenmerk','cc','nieuws')) as contract,
--          count(*) filter (where f.show_when_field_id is not null and f.field_key in ('fase','weekly_criteria',
--            'trade_concept','entry','w_confirm','d_confirm','h4_confirm','extra_d_conf','weekly_kenmerk','cc','nieuws')) as conditioneel
--     from methodologies m join methodology_fields f on f.methodology_id = m.id
--    where exists (select 1 from methodology_fields x where x.methodology_id = m.id and x.field_key = 'fase')
--    group by m.id, m.naam, m.user_id;   -- verwacht: kenmerken = 0, contract = 11, conditioneel = 0
--   -- 3b. kenmerk-historie bewaard in de bag (verwacht: > 0 als er ooit kenmerken zijn ingevuld):
--   select count(*) from trades where custom ?| array['daily_respecteert_zone','spelers_verleden','structuur',
--     'zone_min_2_touches','engulfing_candle','weekly_bevestigingscandle'];
--   -- 4. elke trade op een fase-journal heeft custom.fase én custom.cc:
--   select count(*) filter (where not (t.custom ? 'fase')) as zonder_fase,
--          count(*) filter (where not (t.custom ? 'cc')) as zonder_cc, count(*) as totaal
--     from trades t where exists (select 1 from methodology_fields f
--       where f.methodology_id = t.methodology_id and f.field_key = 'fase');
--   -- 5. sessie: nullable, trigger op datum_open/tijd_open/custom:
--   select is_nullable from information_schema.columns where table_name = 'trades' and column_name = 'sessie';
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_trades_set_sessie';
--   -- 6. hide_fase weg + kolom-grant (verwacht: display_name, methodology_id, onboarded_at, result_unit, timezone):
--   select column_name from information_schema.column_privileges
--     where table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE' order by 1;
--   -- 7. share-RPC's zonder gedropte kolommen (verwacht: false, false, false):
--   select prosrc like '%hide_fase%' from pg_proc where proname in ('get_shared_journal','get_shared_review');
--   select prosrc like '%fase1_%' from pg_proc where proname = 'shared_trade_json';
--   -- 8. methodology_fases + fase_id weg (verwacht: 0 rijen):
--   select table_name from information_schema.tables where table_name = 'methodology_fases';
--   select column_name from information_schema.columns where table_name = 'methodology_fields' and column_name = 'fase_id';
--   -- 9. rename_field_option zonder slot (verwacht: false):
--   select prosrc like '%legacy field is locked%' from pg_proc where proname = 'rename_field_option';
--   -- 10. registry (verwacht: 1 rij):
--   select filename from schema_migrations where filename = '0059_retire_wpm_fase.sql';
-- =========================================================
