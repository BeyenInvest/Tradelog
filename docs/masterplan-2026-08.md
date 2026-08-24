# Masterplan naar launch — 2026-08-20

> **Dit document vervangt `stappenplan-verder-bouwen-2026-08.md` als leidend plan.** Het integreert (1) de volledige audit van 2026-08-20 (`audit-en-launchplan-2026-08.md`, ronde 1 + 2) met (2) het bestaande letterfase-plan. Werkwijze per fase ongewijzigd: eigen branch → bouwen → lint/test/build groen → review met owner → commit/push alleen op expliciet verzoek; migraties via `scripts/run-migration.mjs`, owner draait, read-only verifiëren.
>
> **Vaste besluiten blijven staan:** geen eigen replay/chart-engine ooit; TradingView is king; differentiatie = methodiek-condities + presets + eerlijke statistiek; alles nieuws achter `beta_features` tot de flip.

## Stand van zaken (geverifieerd)

- **Af:** H, G (deels), J, K, L, M (incl. sessie 2 op main), N2, N4. Prod-DB bij t/m 0042.
- **Open posities: AF en live op main+prod** (migratie 0043 gedraaid, 2026-08-20; niet beta-gated). De audit-bevindingen N7 en N8 zijn daar al meegenomen en geverifieerd.
- **Open uit het oude plan:** G-rest (launch-ops, landing), I-praktijktest (import ligt op branch, nooit met echte CSV getest), N1/N3/N5, O, P.
- **Nieuw uit de audit:** fases Q, R, S hieronder.

## Volgorde

**Q (waterdicht) → R (correctheid & hygiëne) → G-rest + launch-week → S1 (trader-polish, pre-launch-deel) → LAUNCH → I-praktijktest → S2 (trader-verdieping) → N-rest → O → P**

Q en R zijn de nieuwe poortwachters: geen launch zolang Q niet af is. S is gesplitst: S1 = klein spul dat de eerste indruk direct verbetert (vóór launch), S2 = de verdieping (erna).

## Modelverdeling — BINDEND

**Verplichte check bij elke sessie-start:** controleer welk model je bent (staat in je system prompt) vóór je begint te bouwen. Draai je niet op het voorgeschreven model voor de fase die je oppakt, **bouw dan niet** — meld het de owner en vraag om een nieuwe sessie op het juiste model. Dit is geen advies maar een afspraak; de vuistregel erachter: **stats-motor, migraties, security/RLS, destructieve operaties → Fable; UI/views, content, polish → Opus.**

| Fase | Model |
|---|---|
| Q — Waterdicht | **Fable** (verplicht — security + migratie + data-laag) |
| R — sessie 1 (rekenregels, guards, import-logica, RPC, stats-tests, core.ts-uitbreiding SQN e.d.) | **Fable** |
| R — sessie 2 (i18n-veegronde, ConfirmDialog, headers/audit fix, WOFF2, SW-update, git-opruiming) | **Opus** |
| G-rest + launch-week | **Opus** (launch-week zelf = owner-ops) |
| S1 — trader-polish | **Opus** (het core.ts-deel is dan al in R-sessie 1 gedaan) |
| I — import-praktijktest | **Fable** (parser-randgevallen; UX-polish eromheen mag Opus) |
| S2 — per stuk | **Fable:** datetime-migratie + sessie-dimensie, prop v2 (trailing DD), multi-select-veldtype, offline-queue. **Opus:** histogram/kruistabel-views, underwater-chart, dag-laag-UI, projectvergelijking, CSV-export, share-scope, missed-kaart |
| N-rest | N-1 presets **Opus** · N-3 MAE/MFE **Fable** · N-5 review-secties **Opus** |
| O — Monetisatie | **Opus** |
| P — Opruiming/schaal | **Fable** (cyclus 10 + server-aggregatie; kleine restjes Opus) |

---

## Fase Q — Waterdicht (kritiek, ~2 sessies, Fable) — *eerst dit, blokkeert launch*

1. **Migratie 0044 — K1-fix**: `revoke update on profiles from authenticated` + `grant update` op kolom-whitelist (privilege-escalation naar admin/alle data dicht). Owner draait; daarna verifiëren dat self-update van `role` faalt.
2. **H1 — 1.000-rijen-afkap**: gepagineerde fetch-helper (`.range()`-lus) in `useTrades`, ImportModal-dedup en overige hooks — stats zijn anders fout boven 1.000 trades.
3. **N1 — profiel-foutpad**: profielfout blokkerend maken (retry-scherm), mutaties weigeren zolang `profile == null`, TradeForm nooit een system-template-id laten stampen; DB-ownership-check op `trades.methodology_id` (kan mee in 0044).
4. **N2 — GDPR/storage**: storage-delete in `delete_own_account()` (kan mee in 0044); screenshot-delete bij trade-delete/vervanging of orphan-sweep.
5. **N3 — review-relink**: bij wijzigen van jaar/week automatisch `linkTradesToReview` (lost ook N4 grotendeels op).

**Klaar wanneer:** geen enkele gebruiker kan escaleren, stats kloppen bij elke datasetgrootte, een flaky fetch kan geen data misplaatsen, account-delete wist echt alles, en een review toont altijd zijn eigen week.

## Fase R — Correctheid & hygiëne (~2 sessies)

*Rekenregels & datums:* M1 drawdown-baseline op 0; M2 `localTodayIso()`-helper overal (UTC/module-load-bug); N6 week-53-validatie; N5 prop-drawdown minimaal eerlijk labelen (echte trailing → S2).
*Robuustheid:* M3+M7 request-guards + foutpad-statebehoud in `useMethodology`/`useAuth` e.a.; M8 import-dedup-foutafhandeling; N9 import-datumformaat-keuze bij ambigue mm/dd; N10 fetch-fouten door `toErrorMessage`; M5 rename-RPC (transactioneel).
*Zoeken & lijst (semi-bugs):* M4 `instrument` + custom velden in `matchesSearch`.
*Security/deps:* `npm audit fix` (router-CVE); HSTS + Permissions-Policy + Sentry-`connect-src` in `vercel.json`.
*Git & repo:* `git pull` (lokaal achter), 0036-migratiebestand cherry-picken naar main, stale branches opruimen, migratienummer-register in docs kloppend maken.
*Tests:* `format.ts`, `tradeGrouping.ts`, `isoWeek.ts`, `computeOverviewKpis`-compositie.
*Perf quick wins:* mutaties lokaal patchen i.p.v. refetch; fonts → WOFF2; periodieke SW-updatecheck; SWR-cache per scopeKey.
*Klein:* H2 admin-methodologie-override; M6/L2 i18n-veegronde; N12 "Avg RR"-label; N13 deleteJournal-waarschuwingen; N15 native `confirm()` → ConfirmDialog + wizard-focus-trap.

**Klaar wanneer:** alle audit-bevindingen t/m MIDDEL dicht of bewust gedocumenteerd; lint/tests/build groen; repo-hygiëne op orde.

### Migratie-register (N11 — bijgewerkt 2026-08-22)

Volgorde van de recente/relevante migraties en hun status op prod. Eerstvolgend vrij nummer: **0047**.

| Nr | Bestand | Wat | Status prod |
|---|---|---|---|
| 0036 | `revoke_anon_execute` | anon EXECUTE per naam intrekken op alle RPC's + admin-policies `to authenticated` | ✅ gedraaid (2026-08-13). **Bestand ontbrak op main**, hersteld in branch `fase-r-correctheid` (stond alleen op `claude/jolly-cannon-8d47fc`) |
| 0043 | `open_trades` | lopende trades (is_open) | ✅ gedraaid (2026-08-20) |
| 0044 | `audit_hardening` | K1 kolom-grants + N1 ownership-trigger + N2 storage-delete | ✅ gedraaid |
| 0045 | `rename_field_option` | transactionele option-rename-RPC (Fase R s1, M5) | ✅ gedraaid |
| 0046 | `admin_methodology_select` | is_admin() SELECT op methodologies + methodology_fields (Fase R s2, H2) | ✅ gedraaid (2026-08-22) |
| 0047 | `field_label_keys` | label_key/group_key op methodology_fields + render-time-vertaling (Fase G-rest A3) | ✅ gedraaid (2026-08-24) |
| 0048 | `review_sections` | configureerbare review-secties per journal + content jsonb-bag + get_shared_review-uitbreiding (Fase N5) | ⏳ owner draait nog (branch `fase-n5-review-secties`) |

> Eerstvolgend vrij nummer na 0048: **0049**.

## Fase G-rest + launch-week (owner-ops + klein code)

Zoals het oude plan, aangevuld vanuit de audit:

1. **Beta-flip** (code): onboarding-wizard + de "iedereen moet dit"-set uit de gate, óf `beta_features` default aan — zonder dit landt elke nieuwkomer nog in het WPM-jargonformulier. Preset-catalogus meteen opschonen (WPM-preset als "gevorderd" labelen, groeperen per asset-class; wizard-"Overslaan" alleen stap 1).
2. Support-contactlink + account-verwijdering vindbaar maken (code, klein).
3. Terms/Privacy juridisch → teksten erin (owner + code).
4. Landing page op `/` (goedgekeurde mockup → React) — ná designer-logo; PWA-iconen (owner/designer + code).
5. Launch-week owner-ops in volgorde: Turnstile → Supabase URL-config → e-mailtemplates + custom SMTP → Sentry-DSN + uptime-monitoring + DB-backupregeling → signup-toggle aan → smoke-test met vers account. *Na Turnstile: geen Browser-pane meer op prod zonder overleg.*

**Klaar wanneer:** een vreemde meldt zich aan en overleeft de eerste 10 minuten — nu met de zekerheid dat Q/R eronder waterdicht zijn.

## Fase S — Trader-polish & verdieping (uit de feature-inspectie)

### S1 — vóór launch (klein, hoge zichtbaarheid, ~1 sessie)
1. **Kalender: week- en maandtotalen + dag-KPI-kop in DayTradesModal** (hoogste winst per bouwuur; data ligt klaar in `byDay`).
2. **Quick-log pro-klaar**: risk-veld (onthouden), "bewaar & volgende", notitieregel, datumkeuze; quick-log als zichtbare primaire knop.
3. **Invoerfrictie**: outcome overal afleiden uit het teken (patroon bestaat in quick-log); laatst-gebruikt instrument onthouden; sanity-waarschuwing bij >±20% resultaat. *(Invoer in %/R/geld: afstemmen met de open-posities-chat, raakt hetzelfde formulier.)*
4. **KPI-motor afmaken**: grootste win/verlies, gem. risico per trade, SQN/std-dev als StatCards; drawdown-peak/trough-markers op de equity curve.
5. Tradelijst: kolommen journal-bewust (richting/R i.p.v. dode Concept/Entry-kolommen), sorteren op resultaat.

### S2 — na launch (verdieping, per stuk 1 sessie)
1. **R-distributie-histogram + kruistabellen op eigen enum-velden** (setup × sessie) — motor bestaat (`breakdownBy`, `numberBuckets`), alleen views.
2. **Underwater-curve + drawdown-duur**; equity optioneel op tijd-as.
3. **Dag-laag**: dagnotitie + day-win-rate e.d. (kalender wordt einde-dag-ritueel).
4. **`datum_open` → datetime** + sessie/uur-breakdown via `profiles.timezone` (grootste inhoudelijke gat voor universele journals).
5. **Acties-carry-over** in weekly review + adherentie/breakdown-blok in de PDF + periode-vergelijk in periodieke reviews.
6. **Adherentie**: drilldown naar trades, trend per week, samenvattings-StatCard bovenaan.
7. **Missed-trades-analyse** (hypothetisch gelabeld, buiten echte KPI's) + reden-veld.
8. **Prop-accounts v2**: `drawdown_type` static/trailing/EOD + peak-invoer, consistency-reminder, account-totalen ("payout YTD"), reset-log, "laatst bijgewerkt"-stempel.
9. **Backtest-projecten v2**: periode/markt-metadata, parameternotities, status + conclusieveld, projectvergelijkings-view (RPC levert cijfers al).
10. **Multi-select-veldtype** + breakdown; **CSV-export**; share-scope-keuze (stats-only vs. incl. notes); offline-queue voor quick-log; lot-calc "gebruik in trade"-brug; econ. kalender asset-gaten; vrije screenshot-labels.

## Fase I-praktijktest (bestaand, direct na launch mogelijk)

Import met echte MetaTrader- én TradingView-CSV's testen → branch `fase-i-import`/`fase-2-scale-import` mergen (incl. het vastzittende `weekly-review-pdf-polish`-restje) → geparkeerde trader-verbeteringen A/B/C heropenen. N9 (datumformaat) landt hier als het niet al in R zat.

## Fase N-rest (bestaand)

- **N-1** Meer presets (ICT/SMC, breakout, mean-reversion, opties-wheel).
- **N-3** MAE/MFE — ná de I-praktijktest (bewuste afhankelijkheid). Bedient samen met `planned_rr` (klein veld, kan eerder mee in S2) de exit-analyse.
- **N-5** Review-secties configureerbaar per journal.

## Fase O — Monetisatie (beslismoment owner, ongewijzigd)

Freemium-gate op `profiles.plan` (nu ook echt afdwingbaar dankzij de K1-fix — vóór die fix was elke plan-limiet omzeilbaar); Stripe pas als owner het aankaart.

## Fase P — Opruiming & schaal (ongewijzigd, aangevuld)

Cyclus 10 (WPM-kolommen droppen); server-aggregatie pas bij echte >10k-users (samen met list-paginering); N14 (`profiles_recompute_sessie`-batching) en TradeList-virtualisatie horen hier.

---

## Bewust nooit / nog niet (ongewijzigd)

Geen replay/chart-engine, geen AI-laag (nog), geen community, geen live broker-integratie. Partials/scale-outs: bekende grens, niet bouwen tot import het afdwingt.

## Direct volgende stap

**Fase Q, sessie 1 (Fable):** migratie 0044 schrijven (K1 + N1-ownership-check + N2-storage-delete in één migratie), owner draait hem, daarna H1-paginering + N1-client-kant + N3-relink. Coördinatie met de open-posities-chat: N7+N8 daar melden; trade-form-bestanden mijden tot die chat gemerged is.
