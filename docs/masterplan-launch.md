# Masterplan — resterende weg naar de beta-launch (2026-08-27)

> **Dit document vervangt `masterplan-2026-08.md` als leidend plan.** Alles wat af is, is eruit gehaald; de historie (fases A t/m S2, audit-afvinklijsten, concurrentie-analyse) staat in het oude masterplan en in `docs/audit-2026-08-27.md` (12-agent-audit, 2 rondes — de bron van Fase T hieronder). Werkwijze ongewijzigd: eigen branch → bouwen → lint/test/build groen → review met owner → commit/push alleen op expliciet verzoek; migraties via `scripts/run-migration.mjs`, owner draait, read-only verifiëren.
>
> **Vaste besluiten blijven staan:** geen eigen replay/chart-engine ooit (TradingView is king); differentiatie = methodiek-condities + presets + eerlijke statistiek; geen community, geen live broker-integratie; partials/scale-outs niet bouwen tot import het afdwingt.

## Stand van zaken

- Prod = `origin/main` @ `fb440da`, migraties t/m **0051** gedraaid. Eerstvolgend vrij migratienummer: **0052**. (Registervoetnoot: 0020 bestaat dubbel, 0034 ontbreekt — historisch, geen actie.)
- **De volledige beta-scope is code-compleet en live op prod**; repo groen (tsc, 372 tests, build, npm audit 0).
- Wat de beta nog tegenhoudt: **Fase T** (audit-fixes, klein), het **designer-logo** (blokkeert de landing), en de **owner-launchweek**.

## Modelverdeling — BINDEND

**Verplichte check bij elke sessie-start:** controleer welk model je bent vóór je bouwt; verkeerd model voor de fase = niet bouwen, owner melden. Vuistregel: **stats-motor, migraties, security/RLS, destructieve operaties → Fable; UI/views, content, polish → Opus.**

| Werk | Model |
|---|---|
| T1 — migratie 0052 + datalaag/import/stats | **Fable** |
| T2 — UI/product-fixes + analyse-defaults | **Opus** |
| T3 — docs/branch-hygiëne | **Opus** |
| B5 — landing page | **Opus** |
| Weekly digest (na launch) | **Fable** (infra/cron) + Opus (inhoud) |
| S2-restant per stuk | **Fable:** prop v2 trailing DD, multi-select-veldtype, offline-queue · **Opus:** underwater-chart, dag-laag-UI, projectvergelijking, CSV-export, share-scope, missed-kaart |
| O — monetisatie | **Opus** |
| P — opruiming/schaal (cyclus 10, server-aggregatie) | **Fable** |

---

## Fase T — Audit-fixes 2026-08-27 (vóór de beta; past in de logo-wachttijd)

Bron: `docs/audit-2026-08-27.md`. Context: rekenmotor numeriek geverifieerd correct (31/31), geen backtest↔live-lek, geen cross-tenant-datalek voor ingelogde gebruikers, S2-1 is de enige create-or-replace-regressie ooit — wat rest is onderstaand fixwerk.

### T1 — Fable (datalaag/security/stats, ~1-2 sessies) — *eerst dit, het lek staat op prod*
1. **Migratie 0052** (owner draait; daarna read-only verificatie + test dat een review-share geen open trades meer levert):
   - `get_shared_review` hercreëren mét `and not t.is_open` in beide trades-subqueries (S2-1, HOOG — 0048-regressie);
   - `is_open` én `tijd_open` toevoegen aan `shared_trade_json` (tweede verdedigingslinie + M5-a);
   - anon-EXECUTE-revoke op `compute_sessie_at` (0036-conventie);
   - composiet-index `trades(user_id, methodology_id, datum_open)`;
   - conventie-comment: share-RPC's altijd hercreëren vanaf de láátste versie.
2. **C2** quick-log `is_system`-guard (1 regel — vers skip-account kan nu geen quick-log opslaan) + **C1** `profileError` alleen fataal zonder geladen profiel (2 regels — voorkomt app-breed foutscherm bij token-refresh-hikje).
3. **B1** admin-Analyse op journal scopen; **B2** extremen-kaart correct in R-modus.
4. Import: **P-exp** exponentnotatie-fix in `parseNumber` (stille corruptie: `1e5` → 15) + **B4** `datum_sluiting >= datum_open`-guard. Daarna is de import volgens de fuzz-audit un-gate-klaar (owner-besluit).
5. **M1-a** review-relink bij datum-wijziging + **M1-b** review-form gaten op sections-loading (dataverlies-klasse); **M4-a** journal-aanmaak atomair (RPC) — vóór de signup-toggle.
6. **P1** mutatie-patching in `useTrades` (lost meteen het C4-duplicaatrisico grotendeels op).
7. Tests: kalendertotalen-logica naar `src/lib/` + tests; `localDate.ts`-tests.

### T2 — Opus (UI/product, ~1 sessie)
1. **UX-A/B** fase-kolom verbergen voor moderne journals + `columnMode` in ReviewTradeGroups (WPM-lek dat elke nieuwe gebruiker ziet).
2. **UX-C** kruistabel-default = eerste dimensie mét data.
3. **UX-D** `tijd_open`-invoerveld un-gaten + optioneel tijdveld in quick-log.
4. **P2** periodieke SW-update-check (PWA staat voor iedereen aan).
5. **M2-a** actief-toggle op prop-accounts (geld-modus leunt erop); **M4-b** dode startset-combinaties uitgrijzen.
6. **Analyse-defaults**: eerste bezoek = KPI-rij + equity open, rest ingeklapt; "Series van 5" default dicht. → **Vuistregel vanaf nu (BINDEND): elke nieuwe analyse-sectie landt default-ingeklapt en/of achter een per-journal-opt-in (0050-patroon) — nooit meer default-open erbij.**
7. Klein: "win rate"-string i18n, stale gating-comments (TradeJournalView/BacktestingAnalysisView/vite.config), Settings-"Trading"-sectie legacy-only, C5 loading-gate op de Analyse-tab.

### T3 — Opus (hygiëne, ~½ sessie)
Masterplan-/audit-docs committen; CLAUDE.md/README-drift bijwerken (audit §5); oude handoff-docs archiveren; branch-opruiming (~28 gemergde branches + stash-check, met owner-akkoord); C6 try/catch om `lang`/`theme` + userId in tradeMemory/pairMap-keys.

---

## Weg naar de beta — volgorde

1. **T1 (Fable)** — 0052 + kritieke fixes. *Eerst.*
2. **Designer-logo + PWA-iconen** (owner/designer) — loopt parallel; harde blokkade voor de landing.
3. **T2 + T3 (Opus).**
4. **B5 — Landing page** op `/` (Opus, zodra logo er is): goedgekeurde mockup → React (`docs/` + artifact, zie fase-G-rest-handoff). Positionering t.o.v. Create Impacts: volwaardig journal gratis, meerdere journals, %/R/$-weergave, screenshot-upload, open trades.
5. **Juridische review Terms/Privacy** (owner) — niet blokkerend voor gratis beta, wél vóór Stripe.
6. **B6 — Launch-week owner-ops**, in volgorde: Turnstile-site → Supabase URL-config → e-mailtemplates + custom SMTP → Sentry-DSN + uptime-monitoring + DB-backupregeling → "Allow new users to sign up" aan (pas ná T1's M4-a) → smoke-test met vers account. *Ná Turnstile: geen Browser-pane meer op prod zonder overleg.*
7. 🚀 **Beta-launch.** Check bij launch: PWA-update-gedrag verifiëren met een vers account.

---

## Ná de launch (op volgorde van impact)

1. **Weekly digest e-mail** (eerste na launch; Fable infra + Opus inhoud) — wekelijkse stats + focuspunten; goedkoopste retentie-win, concept bewezen door concurrent.
2. **Hardening-verzamelmigratie** (Fable): vijf uuid-bestaans-oracles (0044-triggerpatroon op reviews/prop_accounts/show_when_field_id), jsonb-/lengte-CHECKs, anon-revoke op preset-tabellen, `base-uri`/`form-action` in CSP, `account_size > 0`-CHECK.
3. **Kleine restjes uit de audit**: C3 profiel-refetch op focus (multi-tab-staleness), M3-a per-project import-dedup, offline-banner, histogram-halfronding (±0,5R), B3 (screenshot-cleanup >1000), schema.sql weer volledige bootstrap, font-preconnect, search-debounce, `date-fns` verwijderen, equity-downsampling + `React.memo` om charts. Formula-escaping (`= + - @`) is een harde eis zodra ooit een CSV-export gebouwd wordt.
4. **S2-restant** (verdieping, per stuk gemodelleerd — zie tabel): underwater-curve + drawdown-duur; dag-laag (dagnotitie, day-win-rate — kalender als einde-dag-ritueel); acties-carry-over in weekly review + adherentie-drilldown/trend; missed-trades-analyse (hypothetisch gelabeld) + reden-veld; prop-accounts v2 (`drawdown_type` static/trailing/EOD, payout YTD, reset-log); backtest-projecten v2 (metadata, status/conclusie, vergelijkings-view); multi-select-veldtype + breakdown; CSV-export; share-scope-keuze; offline-queue quick-log; lot-calc-brug; econ-kalender asset-gaten; vrije screenshot-labels.
5. **Post-launch-register** (uit de Create Impacts-audit): discipline-pack als preset-veld-pack; trade-plan-builder; AI-laag (plan-PDF-extractie → regels → compliance %); share-cards/streaks (marketing-tijdvak). Pricing-anker: €19/29 werkt in de Benelux; free tier gul houden ("volwaardig journal gratis").
6. **Fase O — Monetisatie** (beslismoment owner): freemium-gate op `profiles.plan` (afdwingbaar sinds de K1-fix); Stripe pas als owner het aankaart. EN-vertaling legal-pagina's vóór betaalde launch.
7. **Fase P — Opruiming & schaal**: cyclus 10 (WPM-kolommen droppen — extra gemotiveerd door de concurrent-waarschuwing), server-aggregatie + list-paginering pas bij echte >10k-users, N14-batching, TradeList-virtualisatie.

## Bewust nooit / nog niet

Geen replay/chart-engine, geen community, geen live broker-integratie. AI-laag: post-launch-kandidaat, niet eerder. Partials/scale-outs: pas als import het afdwingt.
