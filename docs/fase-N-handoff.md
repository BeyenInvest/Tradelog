# Fase N — startdocument (voor nieuwe sessie, model: **gemengd, per stuk kiezen**)

> Geschreven 2026-08-20 na afronding van Fase M; bijgewerkt 2026-08-20 na
> afronding van **N2 (AF, live op prod)**. Model-afspraak (memory
> `beyen_model_per_fase`): **N = gemengd** — stats-motor / migraties / security
> → Fable, UI-stukken → Opus. Vervangt samen met `docs/fase-M-N-handoff.md`
> (M-deel is AF) het oude startpunt.

## Uitgangsstand (belangrijk — lees eerst)

- **N2 is AF en live op prod**: `main` = `8bc783d` (feature `342a9f1` +
  live-journal-only-fix), gepusht, Vercel-deploy geverifieerd (nieuwe bundle
  op beyen.app). Geen migratie gebruikt. Werkboom schoon.
- **Eerstvolgende vrije migratienummer: `0041`.**
- Branch per N-stuk **vanaf `main`**; gedeelde worktree (nooit `git add -A`,
  alleen eigen bestanden stagen); commit alleen op expliciete vraag;
  `npm run lint` + `test` + `build` clean vóór "klaar".
- **Alles nieuws achter de beta-gate** (`useAuth().betaFeatures`) — gating-regel
  uit CLAUDE.md blijft leidend.
- Missed trades nooit in echte stats: altijd via `takenTrades()` e.d. uit
  `src/lib/stats/core.ts`. `TradesApi` = één gedeelde instantie per pagina.
- Migraties draait de owner zelf (Supabase SQL-editor; idempotent bestand,
  expliciete grants/revokes — anon by name revoken). Let op: het runner-script
  `scripts/run-migration.mjs` bestaat **niet** op main en `pg` is geen
  dependency — voor read-only verificatie: `npm i --no-save pg`, dan
  `node --env-file=.env.local --input-type=module -e "…"` met
  `process.env.SUPABASE_DB_URL`.

## Fase N — Methodiek-verdieping (doorlopend, per sessie één stuk)

Losse, onafhankelijke bouwstenen — kies er per sessie één. Elk stuk zelfstandig
deploybaar.

### N1. Meer presets (UI-licht → Opus of Fable)
Nieuwe journal-presets: ICT/SMC, breakout, mean-reversion, opties-wheel, ….
- Patroon = bestaande presets: migraties `0027`/`0028` + `PresetPicker`
  (cyclus 6), ontwerp in `docs/journal-presets.md` (uitbreiden).
- Puur additief: preset-definities + seeds, geen gedragswijziging.

### N2. Regel-adherentie-analyse — **AF** (2026-08-20, Fable)
Live op prod (`342a9f1` + `8bc783d`), beta-gated. Wat er staat:
- `src/lib/stats/adherence.ts`: `computeEvaluationImpact` (Good vs
  Emotional/Technical in R + gap/geschatte kost) en `computeConditionGaps`
  (best/slechtst presterende veld-waarde per dimensie, min. 15 trades).
- `AdherenceSection` in de Analyse-tab, **live-journal-only**
  (`showAdherence`-prop; owner-besluit: niet in backtest-projecten) en zonder
  dag/kwartaal (`dateDerived`-vlag — kalender-splitsingen zijn geen condities).
- Bijvangst voor volgende sessies: `groupByKey` (gedeelde grouping-primitive in
  `stats/breakdown.ts`), `GRADED_EVALUATIONS`/`GradedEvaluation` afgeleid in
  `constants.ts`, `isGraded`/`isGradedError` in `stats/core.ts`.
- Bewust open gelaten (review-finding, aparte refactor): de actieve-dimensie-
  lijst wordt 2× afgeleid in `BacktestingAnalysisView` (breakdown-secties +
  `adherenceDims`).

### N3. MAE/MFE (migratie + stats → **Fable**) — **WACHT op Fase I-validatie**
Twee optionele kolommen (handmatig of uit CSV) + exit-analyse-rapport.
- Voorwaarde uit het M+N-startdoc: pas zodra de import (Fase I) met échte
  MetaTrader/broker-CSV's is gevalideerd — dat is nog niet gebeurd
  (memory `import_workflow_parked`). Niet als eerste kiezen.

### N4. Onboarding-wizard (UI → Opus)
First-run: naam + timezone + keuze blanco-of-preset (memory
`beyen_onboarding_flow_deferred`: GEEN straat/telefoon).
- Hergebruikt de cyclus-6 `PresetPicker` en de Fase-C `JournalEmptyState`.
- Waardevol vóór public launch (signup staat nu nog dicht).

### N5. Review-secties configureerbaar per journal (migratie + UI → gemengd)
Fase F "later"-variant: zelfde patroon als `methodology_fields`, maar dan voor
de review-secties. Grootste stuk; migratie + editor-UI.

### Optioneel: Fase M sessie 2 (kan óók als "N-stuk" gekozen worden)
Restjes uit de M-review, genoteerd in memory `beyen-fase-m-sharing`:
- **Review-sharing**: één weekly/periodic review delen via een share-link
  (CHECK op `share_links.scope` versoepelen + review-verwijzing + RPC-uitbreiding).
- **Custom-journal-velden in de gedeelde/admin trade-detail-modal**
  (`ReadOnlyTradeDetailModal` toont nu alleen de vaste WPM-velden, niet
  `trades.custom` — RPC zou dan ook `methodology_fields`-labels mee moeten geven).
- Klein: KPI-rij van SharePage ↔ TradeJournalView delen (bewust geskipte
  reuse-finding).

## Volgorde-advies (bijgewerkt na N2)

1. **N4 onboarding-wizard → Opus** — eerstvolgende sessie. Grootste
   launch-waarde (signup staat nog dicht; nieuwe gebruikers landen anders in
   een leeg journal). Puur UI, hergebruikt `PresetPicker` + `JournalEmptyState`.
2. **N1 meer presets → Opus** — snelle brede winst, puur additief
   (migratie-seeds volgens het 0027/0028-patroon + `docs/journal-presets.md`
   uitbreiden). Kan ook vóór N4 als je iets kleins wil.
3. **N3 MAE/MFE → Fable** — blijft WACHTEN op Fase I-validatie met een echte
   broker-CSV (memory `import_workflow_parked`). Pas daarna oppakken.
4. **N5 review-secties configureerbaar → gemengd** (migratie/datamodel Fable,
   editor-UI Opus) — grootste stuk, als laatste.

Optioneel tussendoor: **Fase M sessie 2** (review-sharing + custom-velden in de
gedeelde modal) **→ Fable** (RPC-uitbreiding + CHECK-versoepeling = security-werk).

Na elk stuk: `/code-review` over de branch vóór merge (ving bij M 10 findings,
waarvan 2 security; bij K 2; bij J 14).

## Overige open restjes (blokkeren N niet)

- Definitieve PWA-iconen (designer; placeholders in `public/pwa-*`).
- Mobiel-viewport-check van geraakte schermen (stappenplan L-item 3).
- K-items PDF-embedding + vrije screenshot-lijst (bewust uitgesteld).
- Vóór public launch: Turnstile/CAPTCHA weer aanzetten (README §5) — daarna
  Browser-pane op prod eerst opnieuw met de owner afstemmen (CLAUDE.md).
- `npm audit`: 3 vulns (nanoid/react-router) = pre-existing, niet aanraken.
