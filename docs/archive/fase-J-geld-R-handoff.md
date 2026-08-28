# Fase J — Resultaat-eenheid (%/R/geld) — Handoff

> Startdoc voor een verse chat die Fase J bouwt. Lees ook: `docs/ontwerp-configureerbaar-journal.md` §6 (het ontwerp) en `docs/stappenplan-verder-bouwen-2026-08.md` Fase J. Werkwijze: branch off `main`, `npm run lint`/`test`/`build` groen houden, committen alleen op verzoek, migraties via de Supabase SQL Editor (niet automatisch).

## Doel
Per-user keuze om resultaten te tonen in **%**, **R** of **geld (€/$)**. Grootste doelgroep-verbreder — bijna iedereen wil geld-P&L, wij zijn nu %-only.

## Kernprincipe (NIET schenden)
- `src/lib/stats/*` rekent en test **volledig in %**. Geen enkele stats-functie of stats-test mag wijzigen. (Stappenplan-klaar-criterium: "zonder dat één stats-test wijzigt.")
- Conversie gebeurt **puur in de weergavelaag**.
- Missed-trades blijven overal uitgesloten via de bestaande helpers (`isMissed`/`takenTrades`; `computeRStats` sluit ze al uit).

## Data-model
- Nieuw `result_unit_enum` = `('percent','R','currency')`; kolom `profiles.result_unit` **default `'percent'` not null**.
- **Migratie: eerste vrije nummer.** In de tracked folder is `0035` de hoogste, maar `0034` (was uncommitted) en `0036` (stond op worktree-branch `claude/jolly-cannon`) bestaan mogelijk elders — check eerst, pak dan het eerste écht vrije nummer (waarschijnlijk **0037**). Spiegel in `supabase/schema.sql`. Draaien + read-only verifiëren via Supabase SQL Editor.
- Expose in `src/hooks/useAuth.tsx` net als `hideFase`/`betaFeatures`: `resultUnit: profile?.result_unit ?? 'percent'`.
- Keuze-UI op `/settings` (percent/R/geld), **achter `betaFeatures`** (gating-regel: álles nieuws achter beta).

## De drie eenheden
1. **percent** (huidig): `resultaat_pct`, ongewijzigd.
2. **R** (goedkoopste eerste stap): `rMultiple(trade)` bestaat al in `core.ts`; aggregaten `totalR`/`avgR` ook (`computeRStats`). R-weergave = per-trade `rMultiple` + de R-aggregaten i.p.v. de %-varianten tonen.
   - ⚠️ Caveat: bij `risk_pct = null` neemt `riskPct()` 1% aan → R = % numeriek. Geldt o.a. voor **alle broker-imports** (die hebben geen risk_pct). Eerlijk tonen of markeren.
3. **currency (de grote haak)**: vereist een geld-bedrag per trade. Opties:
   - (a) **Account-saldo-koppeling:** `pnl = resultaat_pct/100 × accountsaldo`. Saldo uit een gekoppeld `prop_accounts`-record of een per-journal saldo-instelling. Approx maar simpel → **MVP**.
   - (b) **Per-trade bedrag-kolom** (`trades.pnl_amount`): exact, maar vereist invoer/import.
   - (c) ⭐ **Broker-imports dragen het echte geldbedrag al** (`ParsedDeal.pnlAmount` in `src/lib/import/types.ts`) — dat gooien we nu weg bij het omzetten naar %. Bewaren in een nieuwe `trades.pnl_amount` zou geïmporteerde trades meteen in echt geld tonen. Haakt direct aan de geparkeerde **import↔account-koppeling** uit Fase I.
   - **Aanbeveling:** R eerst (geen data nodig), dan currency via (a) als MVP, later (c) exact bedrag voor imports.

## Conversie-laag (concreet)
Centrale helper, uitbreiding van `src/lib/format.ts` (heeft al `formatEUR`, `formatProfitFactor`) of nieuw `src/lib/resultFormat.ts`:
```ts
type ResultUnit = "percent" | "R" | "currency";
formatResult(pct: number, unit: ResultUnit, ctx?: { rMultiple?: number; amount?: number }): string
// percent -> "+1.10%"  | R -> "+1.10R"  | currency -> teken + formatEUR(amount)
```
Elke weergave-plek leest `resultUnit` (uit `useAuth`) en routet door deze helper. Behoud de bestaande +teken/kleur-conventie (win=groen, loss=rood, be=oranje).

## Weergave-plekken om te converteren (grep: `resultaat_pct|totalResultaat|avgR|totalR`)
- `src/components/trades/TradeJournalView.tsx` — Overview-KPI-rij (Resultaat, Gem. R al aanwezig)
- `src/components/trades/TradeListItem.tsx` — per-trade resultaat
- `src/components/calendar/CalendarView.tsx` — per-dag totalen + chips
- `src/components/backtesting/BacktestingAnalysisView.tsx` — KPI's + curves
- `src/components/breakdown/BreakdownTable.tsx` + `src/lib/stats/breakdown.ts` — per-dimensie resultaat
- `src/lib/stats/series.ts` + equity/cumulatief-grafiek — Y-as/tooltip
- `src/lib/pdf/reviewPdfData.ts` + `src/lib/pdf/ReviewPdfDocument.tsx` — de `fmtPct`-helpers (regels ~108 / 171 / 292)
- admin: `ReadOnlyTradeTable.tsx`, `ReadOnlyTradeDetailModal.tsx`, `AdminUserDetailPage.tsx`
- reviews: `src/components/reviews/ReviewStatsHeader.tsx`, `src/pages/ReviewsPage.tsx`

## Sub-slices (voorgestelde volgorde binnen Fase J)
1. **Data + hook:** migratie (0037) + schema + `useAuth.resultUnit` + settings-keuze (achter beta). Nog geen conversie → alles blijft %.
2. **R-weergave:** conversie-helper + KPI-rij + trade-lijst in R. Geen migratie. Klaar wanneer %↔R schakelen alleen de weergave verandert.
3. **R overal:** calendar, breakdowns, curves, PDF, admin.
4. **Currency-MVP:** account-saldo-bron kiezen; `pct×saldo`; helper uitbreiden.
5. **Currency exact (optioneel):** `trades.pnl_amount`-kolom + import bewaart `pnlAmount`; exacte geld-P&L voor imports.

## Klaar-criterium
Dezelfde KPI-rij en curves tonen in %, R of € naar keuze, **zonder dat één stats-test wijzigt**.

## Let op
- Gate alles op `useAuth().betaFeatures`.
- `round2()` normaliseert `-0 → 0` — blijf die gebruiken bij afronden.
- Niet in `stats/*` rekenen in R/geld — puur weergave.
- De import-R-caveat (zie eenheid 2) is bekend en acceptabel; niet "fixen" in stats.
