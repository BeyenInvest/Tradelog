# Fase N — startdocument (voor nieuwe sessie, model: **gemengd, per stuk kiezen**)

> Geschreven 2026-08-20 na afronding van Fase M (share-links, live op prod).
> Model-afspraak (memory `beyen_model_per_fase`): **N = gemengd** — stats-motor /
> migraties / security → Fable, UI-stukken → Opus. Vervangt samen met
> `docs/fase-M-N-handoff.md` (M-deel is AF) het oude startpunt.

## Uitgangsstand (belangrijk — lees eerst)

- **Fase M is AF en live op prod**: `main` = merge `17e7e68` (fase-commit
  `59b2e54`), gepusht, Vercel-deploy geverifieerd. Migratie `0040` (share_links
  + `get_shared_journal`-RPC) is op prod gedraaid en read-only geverifieerd.
  Werkboom schoon. In dezelfde merge liftte de losse fix mee: admin-kalender
  telt missed trades niet meer mee (PR #8).
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

### N2. Regel-adherentie-analyse (stats-motor → **Fable**)
"Wat kost afwijken van je eigen condities?" — koppel `trade_evaluation`
(Emotional/Technical error) + veld-waarde-combinaties aan P&L-verschil.
- Pure functies in `src/lib/stats/` (nieuw bestand, met tests), view leest alleen.
- UI: extra sectie in de Analyse-tab (`BacktestingAnalysisView` of eigen kaart),
  beta-gated. Geen migratie nodig — alles zit al in de trade-data.

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

## Volgorde-advies

**N2 (regel-adherentie) eerst** — hoogste trader-waarde, geen migratie, past bij
een Fable-sessie. Daarna N1 (presets, snelle brede winst) of N4 (onboarding,
launch-voorbereiding). N3 wacht op echte CSV-tests; N5 is het grootste stuk.

Na elk stuk: `/code-review` over de branch vóór merge (ving bij M 10 findings,
waarvan 2 security; bij K 2; bij J 14).

## Overige open restjes (blokkeren N niet)

- Definitieve PWA-iconen (designer; placeholders in `public/pwa-*`).
- Mobiel-viewport-check van geraakte schermen (stappenplan L-item 3).
- K-items PDF-embedding + vrije screenshot-lijst (bewust uitgesteld).
- Vóór public launch: Turnstile/CAPTCHA weer aanzetten (README §5) — daarna
  Browser-pane op prod eerst opnieuw met de owner afstemmen (CLAUDE.md).
- `npm audit`: 3 vulns (nanoid/react-router) = pre-existing, niet aanraken.
