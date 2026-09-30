# Plan — Handelsweek: zondag vanaf 22:00 = volgende week

**Owner-besluit 2026-09-30** (uitzondering op de feature-freeze, genoteerd in `docs/fixplan-2026-09.md`).
**Model: Fable** (migratie 0063 + triggers + stats-helper). Eén branch, één PR.

## Probleem

Een trade die zondag om 23:00 genomen wordt (Asia-/Sydney-open, futures-open) hoort voor een trader bij de **nieuwe** handelsweek. De app gebruikt overal de pure ISO-week (ma–zo), dus zo'n trade valt nu in de weekly review, weekgroepering en het weektotaal van de week die net voorbij is.

## Regel (bindend)

> Een trade met `datum_open` op een **zondag** én `tijd_open >= 22:00` hoort bij de ISO-week van de **maandag erna**. Al het andere volgt gewoon de ISO-week van `datum_open`.

- `tijd_open` is naïef in de tijdzone van het profiel (0051), dus "22:00" = 22:00 lokale tijd van de trader. Er is geen tijdzone-conversie nodig.
- Een zondag-trade **zonder** `tijd_open` blijft in de oude week. Dat is een bewuste keuze van de owner.
- De jaarwissel werkt vanzelf: zondag 22:00 in week 52/53 schuift naar week 1 van het volgende ISO-jaar (reken via `datum_open + 1 dag`).
- De grens wordt één constante (`SUNDAY_ROLLOVER = "22:00"`), in TS en in SQL. Geen profielinstelling (freeze).

## Scope — "overal" (owner)

| # | Plek | Nu | Wordt |
|---|---|---|---|
| 1 | DB-trigger `link_trade_to_weekly_review` (schema.sql ~1100) | `extract(isoyear/week from datum_open)` | via SQL-helper met `tijd_open`; trigger-kolomlijst + de "echt gewijzigd"-check óók op `tijd_open` |
| 2 | DB-trigger `link_weekly_review_to_trades` (~1133) | idem | idem |
| 3 | `linkTradesToReview` ([useWeeklyReviews.ts:88](../src/hooks/useWeeklyReviews.ts)) | `datum_open` tussen ma en zo via PostgREST | ontkoppelen/koppelen volgens de regel. Voorstel: RPC `relink_weekly_review(p_review_id)` (security invoker, RLS blijft gelden) die dezelfde SQL-helper gebruikt, i.p.v. de randgevallen in `.or()` te bouwen |
| 4 | `ReviewForm` preview `tradesInWeek` ([ReviewForm.tsx:66](../src/components/reviews/ReviewForm.tsx)) | datumrange | `tradingWeekOf(t)` vergelijken met jaar/week |
| 5 | `weekKey` in [tradeGrouping.ts:42](../src/lib/tradeGrouping.ts) (TradeList "week" + maand-/kwartaalreview-groepering) | `isoWeekOf(datum_open)` | `tradingWeekOf(t)` |
| 6 | PeriodPicker "Deze week" ([PeriodPicker.tsx:13](../src/components/trades/PeriodPicker.tsx)) | ma–zo datumrange | de periodefilter werkt op datums. Kies de schoonste oplossing: óf de filter krijgt een optionele trade-predicaat-variant voor weekranges, óf de weekpreset filtert via `tradingWeekOf`. Maand/kwartaal/jaar blijven puur op datum |
| 7 | Kalender-weektotaal ([calendarTotals.ts](../src/lib/calendarTotals.ts) `weekTotalOf`, CalendarView:315) | som van de cellen in de rij | zondag-trades ≥22:00 tellen mee in het totaal van de **volgende** rij (ook over de maandgrens heen, dus in het totaal van de eerste rij van de volgende maand). De dagcel zelf blijft op de zondag staan. Voeg een subtiele hint/tooltip toe op het weektotaal als er zo'n verschoven trade in zit, anders klopt de rij "zichtbaar" niet |
| 8 | Nieuwe helper in [isoWeek.ts](../src/lib/isoWeek.ts) | — | `tradingWeekOf(datum_open, tijd_open)` → `{ jaar, week_nummer }`; `isoWeekOf`/`isoWeekRange` blijven puur ISO (Habits gebruikt ze) |

**Buiten scope:** Habits (bevroren, niet trade-gebaseerd) · Review-PDF (bevroren; leest de gekoppelde trades, dus volgt vanzelf) · periodieke (maand/kwartaal/jaar) review-ranges en de share-SQL daarvan (datumgebaseerd, geen week) · de extensie (rekent geen weken).

## Migratie 0063

1. SQL-helper, bv. `trading_week_of(d date, t time) returns table(jaar int, week int)` (of `trade_week_monday(d, t) returns date`), `immutable`. Zondag (`isodow = 7`) en `t >= '22:00'` → `d + 1`.
2. `create or replace` van beide link-functies met de helper. Trigger opnieuw aanmaken met `update of datum_open, tijd_open, methodology_id`, en de not-distinct-check uitbreiden met `tijd_open`.
3. Eventueel de RPC uit punt 3.
4. **Backfill** (vóór/na-telling loggen): elke live trade (`backtest_project_id is null`) met `isodow = 7` en `tijd_open >= '22:00'` → `weekly_review_id` opnieuw bepalen (review van de volgende week in hetzelfde journal, anders `null`). Alleen die rijen wijzigen. Tel vooraf hoeveel het er op prod zijn.
5. `supabase/schema.sql` meenemen, inclusief de "t/m 0063"-marker en de registry-rij (`npm run check:migrations`).
6. Volgorde: **migratie eerst, dan deploy** (0043-les). Owner draait 'm via `scripts/run-migration.mjs`, Fable verifieert read-only.

## Tests

- `isoWeek.test.ts`: `tradingWeekOf` — zo 21:59 → oude week, zo 22:00 → nieuwe week, zo zonder tijd → oude week, za 23:00 → oude week, zo 22:00 in week 53 → week 1 van het volgende jaar.
- `tradeGrouping` + `calendarTotals`: een zondag-23:00-trade valt in de volgende weekgroep of rij.
- SQL-verificatie na de run: een zondag-23:00-trade linkt naar de review van de volgende week. Tijd wijzigen van 23:00 → 20:00 laat de trade terugspringen.

## Klaar =

PR gemerged + 0063 op prod geverifieerd + CLAUDE.md (domain rule "handelsweek") + fixplan afgevinkt + eerstvolgend vrij migratienummer bijgewerkt naar 0064.

## Bouwlog

**2026-09-30 (Fable, branch `trading-week-zondag`): code compleet, alle 8 scope-punten gebouwd.** Lint (tsc web+extensie, ESLint 0 errors), 714 tests en `npm run build` + `check:migrations` groen.

- **Punt 8 eerst:** `SUNDAY_ROLLOVER` + `tradingDateOf()` + `tradingWeekOf()` in `src/lib/isoWeek.ts`; `isoWeekOf`/`isoWeekRange` onaangeroerd (Habits blijft puur ISO). `tradingDateOf` accepteert "HH:MM" én het DB-formaat "HH:MM:SS".
- **Punt 1+2 (migratie 0063):** SQL-helper is een scalar geworden — `trading_date_of(d date, t time) returns date`, immutable (schoner dan de table-variant uit het plan; week = `extract(isoyear/week from trading_date_of(...))`). Beide link-functies herschreven, trigger opnieuw aangemaakt met `update of datum_open, tijd_open, methodology_id` + `tijd_open` in de echt-gewijzigd-check.
- **Punt 3 (RPC-voorstel overgenomen):** `relink_weekly_review(p_review_id)` (security invoker, grants alleen authenticated) vervangt de twee PostgREST-datumrange-updates in `useWeeklyReviews.linkTradesToReview` — die leest nu alleen nog de RPC-telling. `onRelink`-keten (ReviewsPage → ReviewDetail → LinkedTradesPanel) versimpeld naar alleen `reviewId`; de RPC leest jaar/week/journal uit de review-rij (dus altijd ná de review-update aanroepen — de bestaande volgorde in `handleSubmit`).
- **Punt 4:** `ReviewForm.tradesInWeek` vergelijkt `tradingWeekOf` met jaar/week; `weekRange` blijft alleen voor de default-datum van een inline nieuwe trade.
- **Punt 5:** `weekKey` in `tradeGrouping.ts` neemt de hele trade en gebruikt `tradingWeekOf`.
- **Punt 6 (gekozen oplossing):** `JournalPeriod extends DateRange` met optionele `tradingWeek`-vlag in `tradeFilters.ts`; alleen het "Deze week"-preset zet 'm, `inRange` filtert dan op `tradingDateOf`. Maand/kwartaal/jaar/custom blijven puur datum; `sameRange` vergelijkt de vlag mee zodat een handmatige ma–zo-range het preset niet oplicht.
- **Punt 7:** `tradingWeekRowTotals()` in `calendarTotals.ts` vervangt `weekTotalOf` — rij-totalen rechtstreeks uit de trades (raw som, één keer afgerond, D1-invariant), zondag ≥ 22:00 telt in de volgende rij, óók over de maandgrens (uit de laatste rij weg, in rij 0 van de volgende maandweergave erbij; de rolled zondag vlak vóór de eerste maandag telt binnenkomend mee). Dagcellen en maandtotaal ongewijzigd. Hint = `*` achter het rijtotaal + tooltip (`calendar.weekTotalShifted`, NL+EN) op **beide** rijen (de rij die verliest én de rij die wint).
- **Migratie 0063 verder:** backfill met vóór/na-`raise notice`, alleen de rollover-rijen zelf (SET raakt alleen `weekly_review_id`, dus de link-trigger vuurt niet); read-only-verificatieblok onderaan; registry-rij + `schema.sql` volledig meegewerkt ("t/m 0063").
- **Tests:** alle plan-gevallen gedekt in `isoWeek.test.ts` (21:59/22:00/zonder tijd/zaterdag/jaarwissel week 52 én 53), `tradeGrouping.test.ts`, `calendarTotals.test.ts` (incl. beide maandgrens-richtingen + pariteit zonder rollover) en `tradeFilters.test.ts` (vlag aan vs. uit).

**Meegebundeld (2026-09-30, verzoek owner via sessie "Screenshots via extensie in admin"): migratie 0064** — admin-select-policy op de private `screenshots`-bucket (0039 had alleen `_own`-policies, waardoor de admin-trade-popup andermans bucket-screenshots niet kon signen). Alleen SQL, geen code-wijziging; zelfde `is_admin()`-patroon als de tabel-policies.

**2026-09-30 (vervolg): 0063 + 0064 gedraaid op prod (owner, 14:25 CEST) en door Fable read-only geverifieerd** — registry bevat beide; `trading_date_of` correct op alle vier de gevallen + jaarwissel (zo 28-12-2025 22:00 → 2026 wk 1); trigger vuurt op `tijd_open`; beide link-functies gebruiken de helper; RPC bestaat als invoker; `screenshots_select_admin` staat (SELECT, authenticated); backfill-sanity 0 fout (1 rollover-kandidaat, correct herbepaald).

**AF (owner):** PR aanklikken op de gepushte branch → CI groen → mergen → fixplan afvinken. Vrij nummer daarna = 0065.
