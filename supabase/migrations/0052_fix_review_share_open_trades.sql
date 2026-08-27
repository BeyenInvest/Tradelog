-- =========================================================
-- Beyen Invest — migration 0052: review-share open-trades-lek dicht (audit
-- 2026-08-27, S2-1 HOOG) + share-allow-list-aanvulling + hygiëne.
--
-- ⚠️ CONVENTIE VOOR ELKE VOLGENDE SHARE-RPC-MIGRATIE (tweede regressie in
-- deze familie, dus nu bindend): een `create or replace` op een share-RPC
-- vertrekt ALTIJD van de body uit de LAATSTE migratie die de functie
-- definieerde — nooit van een oudere versie. Diff vóór het schrijven de
-- vorige definitie (grep de migrations-map op de functienaam) en neem elke
-- where-conditie regel voor regel over. 0048 hercreëerde get_shared_review
-- vanaf de 0042-body en liet daarmee het `and not t.is_open`-filter uit 0043
-- vallen — waardoor een anonieme link-houder de lopende posities van de
-- owner zag.
--
-- Inhoud:
--   1. shared_trade_json: + is_open (tweede verdedigingslinie: de client
--      filtert shares op !t.is_open via closedTrades(), maar dat faalt stil
--      als de key ontbreekt) en + tijd_open (M5-a: gedeelde review toont
--      anders geen tijd en kan binnen één dag anders sorteren dan de owner).
--   2. get_shared_review: exact de 0048-body + `and not t.is_open` in BEIDE
--      trades-subqueries (weekly én periodic). get_shared_journal is al dicht.
--   3. compute_sessie_at: anon-EXECUTE-revoke (0051 vergat de 0036-conventie;
--      hygiëne, geen datatoegang).
--   4. Composiet-index trades(user_id, methodology_id, datum_open): het
--      hoofdleespad (journal-gescopeerde chronologische fetch) — bestond nog
--      nergens (audit R2 §7).
--   5. M1-a: weekly-review-autolink volgt voortaan ook een datum-/journal-
--      wijziging van een trade (was INSERT-only).
--   6. M4-a: create_journal(...) — journal-aanmaak (methodology + velden +
--      activatie) als één transactie i.p.v. 3 losse client-writes, zodat een
--      netwerkfout halverwege geen orphan-journal of duplicaat meer oplevert.
--      ⚠️ De client (useJournalBuilder) roept deze RPC aan zodra dezelfde
--      release deployt — draai deze migratie vóór de deploy.
--
-- Paste into the Supabase SQL editor and run once. Safe to re-run — idempotent.
-- Run: node --env-file=.env.local scripts/run-migration.mjs supabase/migrations/0052_fix_review_share_open_trades.sql
-- =========================================================

-- ---------------------------------------------------------
-- 1. shared_trade_json — de ENE trade-allow-list voor alle share-RPC's
-- (0042). Ongewijzigd op twee toegevoegde keys na: is_open + tijd_open.
-- (create or replace; laatste vorige versie = 0042)
-- ---------------------------------------------------------
create or replace function shared_trade_json(t trades)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', t.id,
    'fase', t.fase,
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
    'weekly_criteria', t.weekly_criteria,
    'weekly_kenmerk', t.weekly_kenmerk,
    'trade_concept', t.trade_concept,
    'entry', t.entry,
    'cc', t.cc,
    'sessie', t.sessie,
    'nieuws', t.nieuws,
    'w_confirm', t.w_confirm,
    'd_confirm', t.d_confirm,
    'h4_confirm', t.h4_confirm,
    'w_screenshot', case when t.w_screenshot ~* '^https?://' then t.w_screenshot end,
    'd_screenshot', case when t.d_screenshot ~* '^https?://' then t.d_screenshot end,
    'h4_screenshot', case when t.h4_screenshot ~* '^https?://' then t.h4_screenshot end,
    'h2_screenshot', case when t.h2_screenshot ~* '^https?://' then t.h2_screenshot end,
    'extra_d_conf', t.extra_d_conf,
    'notes', t.notes,
    'fase1_daily_respecteert_zone', t.fase1_daily_respecteert_zone,
    'fase1_spelers_verleden', t.fase1_spelers_verleden,
    'fase2_daily_respecteert_zone', t.fase2_daily_respecteert_zone,
    'fase2_structuur', t.fase2_structuur,
    'fase3_zone_min_2_touches', t.fase3_zone_min_2_touches,
    'fase3_engulfing_candle', t.fase3_engulfing_candle,
    'fase3_beide', t.fase3_beide,
    'fase3_structuur', t.fase3_structuur,
    'fase4_weekly_bevestigingscandle', t.fase4_weekly_bevestigingscandle,
    'weekly_review_id', t.weekly_review_id,
    'backtest_project_id', t.backtest_project_id,
    'methodology_id', t.methodology_id,
    'custom', t.custom,
    'created_at', t.created_at,
    'updated_at', t.updated_at
  );
$$;

revoke all on function shared_trade_json(trades) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2. get_shared_review — exact de 0048-body, plus `and not t.is_open` in
-- beide trades-subqueries (het 0043-filter dat 0048 liet vallen). Open
-- posities horen NOOIT in een share: ze lekken een lopende positie (pair,
-- datum, richting) naar een anonieme link-houder én verwateren de stats
-- (null-resultaat telt als 0 in JS-sommen).
-- (create or replace; laatste vorige versie = 0048)
-- ---------------------------------------------------------
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
          'hide_fase', p.hide_fase,
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
          'hide_fase', p.hide_fase,
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

-- CREATE OR REPLACE behoudt de bestaande ACL, maar herhaal het grant-paar
-- zodat deze migratie ook op een verse database het juiste eindbeeld zet.
revoke execute on function get_shared_review(text) from public;
grant execute on function get_shared_review(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 3. compute_sessie_at: 0036-conventie — anon-EXECUTE by name revoken (de
-- default privileges granten elke nieuwe functie direct aan anon; een
-- PUBLIC-revoke raakt die grant niet). Triggers roepen de functie aan als de
-- ingelogde gebruiker, dus authenticated houdt EXECUTE (zoals compute_sessie).
-- ---------------------------------------------------------
revoke execute on function compute_sessie_at(date, time, text) from public, anon;
grant execute on function compute_sessie_at(date, time, text) to authenticated;

-- ---------------------------------------------------------
-- 4. Composiet-index op het hoofdleespad: elke journal-gescopeerde fetch
-- filtert op (user_id, methodology_id) en sorteert/vergelijkt op datum_open.
-- ---------------------------------------------------------
create index if not exists idx_trades_user_methodology_datum
  on trades(user_id, methodology_id, datum_open);

-- ---------------------------------------------------------
-- 5. M1-a: review-koppeling volgt een datum-/journalwijziging. De auto-link
-- (0030-body) vuurde alleen op INSERT — een trade waarvan de datum naar een
-- andere week werd bewerkt, bleef stil aan de oude weekly review hangen (die
-- telde hem mee in stats/PDF/share; de nieuwe week zag hem niet). Nu her-
-- resolvet een UPDATE die datum_open of methodology_id écht wijzigt de koppeling
-- (geen match = null, dus ontkoppelen hoort er ook bij). Een expliciete
-- weekly_review_id op INSERT en de handmatige relink-actie in de app
-- (linkTradesToReview, raakt datum/journal niet aan) blijven gerespecteerd.
-- (create or replace; laatste vorige versie = 0030)
-- ---------------------------------------------------------
create or replace function link_trade_to_weekly_review() returns trigger as $$
declare
  iso_year int;
  iso_week int;
  found_id uuid;
begin
  -- backtest_project_id is not null => project trade, never belongs to a weekly review
  if new.backtest_project_id is not null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Ongewijzigd 0030-gedrag: een expliciet meegegeven koppeling respecteren.
    if new.weekly_review_id is not null then
      return new;
    end if;
  else
    -- UPDATE: alleen her-resolven als de week-bepalende velden écht wijzigen —
    -- de kolomlijst van de trigger vuurt al bij het NOEMEN van de kolom in SET
    -- (het volle trade-formulier stuurt altijd alles mee), dus vergelijk zelf.
    if new.datum_open is not distinct from old.datum_open
       and new.methodology_id is not distinct from old.methodology_id then
      return new;
    end if;
  end if;
  iso_year := extract(isoyear from new.datum_open);
  iso_week := extract(week from new.datum_open);
  select id into found_id from weekly_reviews
    where user_id = new.user_id
      and methodology_id is not distinct from new.methodology_id
      and jaar = iso_year and week_nummer = iso_week
    limit 1;
  new.weekly_review_id := found_id;
  return new;
end;
$$ language plpgsql;

-- De event-lijst van de trigger verandert (insert → insert or update of ...),
-- dus drop-then-create.
drop trigger if exists trg_link_trade_weekly_review on trades;
create trigger trg_link_trade_weekly_review
  before insert or update of datum_open, methodology_id on trades
  for each row execute function link_trade_to_weekly_review();

-- ---------------------------------------------------------
-- 6. M4-a: journal-aanmaak atomair. De builder deed 3 losse writes
-- (methodology → fields → profiel-activatie): een netwerkfout halverwege liet
-- een orphan-journal in de switcher achter en een retry maakte een duplicaat —
-- precies het flaky-first-run-pad dat publieke signup gaat raken. Hier als één
-- transactie, SECURITY INVOKER zodat alle RLS-policies gewoon gelden (eigen
-- methodology, eigen velden, eigen profielrij — geen definer-verbreding).
-- p_fields: jsonb-array van veld-objecten in palet-volgorde (zelfde shape als
-- FieldInput in useMethodologyEditor.ts); sort_order = arraypositie (1-based),
-- identiek aan de oude client-insert.
-- ---------------------------------------------------------
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
  -- zo blijft er geen leeg trigger-journal als wees achter.
  if p_reuse_active_if_empty then
    select m.id into target_id
    from profiles p
    join methodologies m on m.id = p.methodology_id
    where p.id = uid
      and m.user_id = uid
      and not m.is_system
      and not exists (select 1 from methodology_fields f where f.methodology_id = m.id);
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
     required, group_label, group_key, show_when_field_id, show_when_values, sort_order)
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
         ord.n::int
  from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) with ordinality as ord(f, n);

  update profiles set methodology_id = target_id where id = uid;

  return target_id;
end;
$$;

-- 0036-conventie: anon by name revoken, authenticated expliciet granten.
revoke execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) from public, anon;
grant execute on function create_journal(text, jsonb, text, jsonb, boolean, boolean) to authenticated;

-- ---------------------------------------------------------
-- Read-only verificatie (na de run):
--   -- filter terug in beide takken (verwacht: 2):
--   select (length(prosrc) - length(replace(prosrc, 'and not t.is_open', ''))) / length('and not t.is_open')
--     from pg_proc where proname = 'get_shared_review';
--   -- allow-list uitgebreid (verwacht: beide true):
--   select prosrc like '%''is_open'', t.is_open%' as has_is_open,
--          prosrc like '%''tijd_open'', t.tijd_open%' as has_tijd_open
--     from pg_proc where proname = 'shared_trade_json';
--   -- anon heeft geen EXECUTE meer op compute_sessie_at (verwacht: false):
--   select has_function_privilege('anon', 'compute_sessie_at(date, time, text)', 'execute');
--   -- authenticated behoudt EXECUTE (verwacht: true):
--   select has_function_privilege('authenticated', 'compute_sessie_at(date, time, text)', 'execute');
--   -- index aanwezig (verwacht: 1 rij):
--   select indexname from pg_indexes where indexname = 'idx_trades_user_methodology_datum';
--   -- trigger vuurt nu ook op update (definitie bevat "INSERT OR UPDATE OF datum_open, methodology_id"):
--   select pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_link_trade_weekly_review';
--   -- create_journal bestaat, invoker, anon mag niet / authenticated wel (verwacht: f / false / true):
--   select prosecdef from pg_proc where proname = 'create_journal';
--   select has_function_privilege('anon', 'create_journal(text, jsonb, text, jsonb, boolean, boolean)', 'execute');
--   select has_function_privilege('authenticated', 'create_journal(text, jsonb, text, jsonb, boolean, boolean)', 'execute');
--   -- functioneel: een review-share met een lopende trade in de periode
--   -- levert die trade NIET meer (draai met een echt token van een test-share):
--   --   select jsonb_array_length(get_shared_review('<token>')->'trades');
-- =========================================================
