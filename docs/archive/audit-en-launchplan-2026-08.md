# Volledige audit & launchplan — 2026-08-20

Vijf parallelle audits (code, security, trader-workflow, performance, launch-gereedheid) over commit `71828ac` (main) + read-only verificatie op de prod-DB. Dit document is het leidende plan richting het "voorlopig eindproduct" en de publieke launch.

**Eindoordeel in één zin:** de codebasis is opvallend gezond en launch-klaar (gating 100% consistent, RLS-fundament sterk, stats-motor gedisciplineerd en getest, i18n in volledige NL/EN-pariteit, alle migraties t/m 0042 geverifieerd op prod) — maar er zijn **2 kritieke bevindingen** die vóór alles gefixt moeten, en de resterende afstand tot launch is vrijwel volledig owner-ops plus een handvol kleine code-taken.

---

## 1. De twee kritieke bevindingen

### K1 — Privilege escalation: elke gebruiker kan zichzelf admin maken
`profiles`-UPDATE-policy (`schema.sql:796`) beperkt alleen *rijen*, niet *kolommen*. Een ingelogde gebruiker kan via PostgREST rechtstreeks `role='admin'` (→ **leestoegang tot álle data van álle gebruikers** via de `*_admin_select`-policies), `beta_features=true` of `plan='pro'` op zijn eigen profiel zetten. De client-side whitelist in `updateProfile` beschermt hier niets.
**Fix (migratie 0044 — 0043 is inmiddels geclaimd door de open-trades-sessie):** `revoke update on profiles from authenticated;` + `grant update (display_name, hide_fase, timezone, methodology_id, result_unit, onboarded_at) on profiles to authenticated;` — daarna verifiëren dat een self-update van `role` faalt.

### H1 — Stille 1.000-rijen-afkap: stats worden fout boven 1.000 trades
`useTrades.refresh()` (r.51) fetcht zonder `.range()`; PostgREST kapt standaard stilzwijgend op 1.000 rijen — de *oudste* 1.000 (sort `datum_open asc`). Boven 1.000 trades zijn KPI's, equity curve, drawdown, win-rate en streaks **onjuist zonder foutmelding**. Zelfde patroon in `useWeeklyReviews`, `usePropAccounts`, admin-queries en de ImportModal-dedup-fetch (onvolledige dedup → harde insert-fout of duplicaten).
**Fix:** gepagineerde fetch-helper (`.range()`-lus tot pagina < 1000) in `useTrades` + ImportModal; zelfde helper voor de overige hooks. ~1 uur werk, dubbel bevestigd door code- én performance-audit.

---

## 2. Hoge bevindingen (fixen vóór launch)

| # | Bevinding | Locatie | Fix |
|---|---|---|---|
| H2 | Admin-analyse gebruikt methodologie van de *kijkende admin* i.p.v. de bekeken gebruiker; `liveTrades` mixt alle journals | `AdminUserDetailPage.tsx:214` + `BacktestingAnalysisView.tsx:53` | `methodologyOverride`-prop (patroon van `hideFaseOverride`) + journal-scoping |
| M1 | Max-drawdown mist 0-baseline: eerste losing streak structureel onderschat (weegt zwaarder door het rolling window) | `core.ts:141-164` | `peak = 0` initialiseren + test aanpassen |
| M2 | "Vandaag" = UTC-vandaag, en in TradeForm bevroren op module-load (PWA-tab die dagen openstaat → oude default-datum; loggen na middernacht → gisteren) | `TradeForm.tsx:29` + 6 andere plekken | gedeelde `localTodayIso()`-helper, `EMPTY_DEFAULTS` → functie |
| M3 | Race conditions: `useMethodology`/`useAuth`/overige hooks missen de `requestIdRef`-guard die `useTrades` wél heeft → verkeerde custom velden na snelle journal-switch | `useMethodology.tsx:125`, `useAuth.tsx:75` | guard-patroon kopiëren |
| M7 | Foutpad `useMethodology.refresh` wist `fields` → legacy-UI (fase-blok) verdwijnt bij één flaky fetch | `useMethodology.tsx:149` | vorige state behouden bij error |
| M4 | Zoeken doorzoekt `instrument` niet → zoeken feitelijk kapot voor non-forex journals | `tradeGrouping.ts:103` | `t.instrument` toevoegen |
| S-M3 | react-router open-redirect-CVE (CVE-2025-68470); directe uitbuitbaarheid beperkt maar bekende CVE vlak vóór launch | `package.json` | `npm audit fix` + build/tests groen |
| S-M5 | HSTS + Permissions-Policy ontbreken; CSP mist Sentry-ingest in `connect-src` (DSN zetten werkt anders niet) | `vercel.json` | headers toevoegen |

## 3. Middel/laag (mag na launch, wel inplannen)

- **M5** `renameFieldOption` niet-transactioneel over 3+N writes → bij netwerkfout halve migratie; naar één RPC-transactie.
- **M8** ImportModal-dedup negeert fetch-fouten volledig.
- **M6/L2** i18n-veegronde: "Weekly reviews"-kop, admin-tab-labels, streak-"0 none", journal-guard-meldingen.
- **L1-L8** (code): types-docstring fase, dubbele ISO-week-implementatie, trade-id als `number`, add-races, DayTradesModal missed-toggle, propFirm-guards, timingDim-filter.
- **S-L9** DB-hardening: lengte-CHECKs op vrije tekst, range op `resultaat_pct`, cap op `custom`-jsonb (self-DoS, geen cross-tenant risico).
- **Testgaten:** `format.ts` (hele Fase J-weergavelaag, 0 tests), `tradeGrouping.ts`, `isoWeek.ts` (jaarwissel!), `computeOverviewKpis`-compositie.
- **Perf:** mutaties lokaal patchen i.p.v. volledige refetch (~2u), SWR-cache per scopeKey (~½ dag), fonts naar WOFF2 (±75 KB first-paint-winst, 15 min), periodieke SW-update-check vóór PWA uit beta gaat (30 min), search-debounce in TradeList, equity-curve-downsampling boven ~500 punten. **Niet doen nu:** server-side KPI-aggregatie (dubbel onderhoud stats-motor; pas relevant samen met list-paginering bij echte >10k-users).
- **Git-hygiëne:** lokale main 2 commits achter (`git pull`); `0036_revoke_anon_execute.sql` staat alléén op branch `claude/jolly-cannon-8d47fc` terwijl hij wél op prod draaide → cherry-pick naar main; stale gemergde branches opruimen; `weekly-review-pdf-polish` (PDF-restyle) zit vast bovenop de import-branch.

## 4. Wat er positief uit de audit kwam (niet opnieuw doen)

- Missed-trade-regel overal via shared helpers — geen enkele view her-filtert lokaal.
- RLS-model, share-token-entropie (256 bit), `get_shared_journal`-allow-list, storage-policies, security-definer-hygiëne, secrets: allemaal in orde.
- Gating van álle 15 beta-features geverifieerd consistent; geen ongegate of dubbel-gegate features.
- i18n: 753 keys NL = 753 keys EN, 0 verschillen. Lint/tests (231) /build: groen.
- Memoization van de stats op orde; geen N+1's; bundle al goed gesplitst (146,6 KB gzip initial).
- Prod-DB: migraties t/m 0042 gedraaid en geverifieerd; eerstvolgend vrij nummer = **0043**.

## 5. Trader-perspectief: te veel / te weinig

**Te veel (opschonen):**
- De niet-beta-flow ís nog de Archer/WPM-flow (jargonformulier) — zie launch-blocker "beta-flip".
- "Weekly Phase Method (Forex)" staat als gewoon recept tussen de neutrale presets → labelen als "gevorderd/specifiek" of onderaan.
- `BacktestingAnalysisView` toont ~25 blokken zonder hiërarchie (incl. Archer-eigen "Series van 5") → top-4 KPI's + uitklapbare rest.
- Kleiner: rolling-window-input op een A-positie, "Missed trade" gemixt in de evaluatie-dropdown, WPM-era custom-opties in Settings voor iedereen, economische kalender ongegate voor non-forex.

**Wat mist (gefilterd op "analyse-laag bovenop TradingView, solo haalbaar"):**
1. **Tijdstip van de trade** (`datum_open` is date-only) → sessie/uur-analyse onmogelijk voor universele journals. Grootste inhoudelijke gat.
2. **Dag-niveau**: day-win-rate, gem. groene/rode dag, dagnotitie in de kalender — het eerste wat een daytrader bij concurrenten ziet.
3. **Multi-select-veldtype** voor confluences/tags (raakt de kern-differentiator).
4. **CSV-export** van trades (vertrouwen + bijna gratis).
5. **Acties-opvolging** in de weekly review ("vorige week nam je je voor: … — gelukt?") gekoppeld aan de N2-adherentie.
6. **Backtest ↔ live-vergelijking** — uniek mogelijk omdat beide dezelfde velden/motor delen; geen concurrent kan dit methodiek-bewust.

**Invoerfrictie-drieslag (raakt elke gebruiker elke dag, bouwstenen bestaan al):** outcome overal afleiden uit het teken (QuickLog doet dit al), resultaat invoerbaar in % / R / geld (opslag blijft %), laatst-gebruikt instrument onthouden + quick-log promoveren van verstopt Zap-icoon naar zichtbare primaire knop.

---

## 6. HET PLAN — vier blokken naar launch

### Blok A — Basis waterdicht (code, ~2-3 sessies, model: Fable voor A1/A2)
1. **Migratie 0043**: K1-fix (kolom-grants profiles) + composiet-index `trades(user_id, methodology_id, datum_open)` + evt. S-L9-CHECKs. Owner draait via de vaste runner; daarna self-update-`role`-test.
2. **H1**: gepagineerde fetch-helper in `useTrades`, ImportModal-dedup en overige hooks.
3. **M2** (`localTodayIso()`), **M1** (drawdown-baseline), **M4** (instrument-search), **M3+M7** (guards/foutpad), **M8**.
4. `npm audit fix` (router-CVE) + `vercel.json`: HSTS, Permissions-Policy, Sentry-`connect-src`.
5. Git-hygiëne: `git pull`, 0036-cherry-pick, branch-opruiming.
6. Tests voor `format.ts` / `tradeGrouping.ts` / `isoWeek.ts`.
7. Perf quick wins: mutatie-patching, WOFF2, SW-update-check.

### Blok B — Launch-voorbereiding (code)
1. **Beta-flip-besluit uitvoeren**: onboarding-wizard (en de "iedereen moet dit"-set) uit de gate, óf `beta_features` default true — zonder dit bestaat het universele product niet voor nieuwe gebruikers en faalt de 5-minuten-first-run.
2. **Invoerfrictie-drieslag** (klein, zie §5) + preset-catalogus opschonen (WPM-preset labelen, groeperen per asset-class) + "Overslaan" in wizard-stap 1 alleen stap 1 laten overslaan.
3. **H2** admin-fix, **M6/L2** i18n-veegronde, **M5** rename-RPC.
4. Support-e-mail/contactlink in de app; Terms/Privacy-teksten verwerken zodra juridisch gereviewd.
5. Landing page op `/` (goedgekeurde mockup → React) — ná designer-logo; PWA-iconen verwerken.

### Blok C — Launch-week (owner-ops, volgorde met afhankelijkheden)
1. Turnstile-site registreren → site key in Vercel, secret in Supabase Attack Protection (README §5 stap 1-3). *Daarna geen Browser-pane meer op prod zonder overleg.*
2. Supabase URL-config (Site URL = beyen.app, redirects `/login` + `/reset-password`).
3. E-mailtemplates nakijken + **custom SMTP** (default Supabase-SMTP is zwaar gelimiteerd).
4. Sentry-project + DSN in Vercel-env; uptime-monitoring; DB-backupregeling (tier/PITR checken).
5. "Allow new users to sign up" aan (pas ná 1-3).
6. Volledige smoke-test met vers account: signup → e-mailbevestiging → onboarding → preset → eerste trade → analyse → review → wachtwoord-reset.
7. Terms/Privacy juridisch laten reviewen (kan parallel, moet af vóór stap 5).

### Blok D — Na launch / next level (impact ÷ moeite)
1. Dag-laag: dag-KPI's in kalender-header + dagnotitie in `DayTradesModal` (middel).
2. `datum_open` → datetime + universele sessie/uur-breakdown via `profiles.timezone` (middel; migratie additief).
3. Acties-opvolging in weekly review + koppeling aan N2-adherentie (klein/middel, on-brand).
4. Multi-select-veldtype + breakdown per waarde (middel); CSV-export (klein).
5. Fase I-import valideren met echte CSV's → branch mergen → daarna N3 (MAE/MFE) vrij; N1 (presets), N5 (review-secties).
6. Analyse-hiërarchie: top-4 KPI's + uitklapbare rest; backtest↔live-brug (groot, uniek).
7. Perf-vervolg alleen bij echte >10k-users: RPC-KPI's + list-paginering (echte Fase 2).

### Door owner te bevestigen (niet verifieerbaar vanaf code/DB)
Vercel-deploy `15df692` Ready; env-vars-stand; Supabase signup/CAPTCHA/URL-config/templates/SMTP/tier; Combell-DNS gezond; designer-traject-status; beta-flip-strategiekeuze.

---

# RONDE 2 — verdiepende audits (zelfde dag, na ronde 1)

Twee extra audits: (a) een feature-voor-feature-inspectie door de pro-traderbril, (b) een adversariële tweede veegronde over alle aspecten, expliciet gericht op wat ronde 1 miste. **Contextnoot:** parallel aan deze audit bouwt een andere chat de "open posities"-feature (migratie `0043_open_trades.sql` in de working tree) — open posities staat daarom níét in de aanbevelingen hieronder, en de K1-fix verschuift naar migratienummer **0044**.

## 7. Nieuwe bevindingen ronde 2 (adversarieel, N-nummers)

### Hoog
- **N1 — Profiel-fetch-fout → trades stil in verkeerd/onzichtbaar journal.** `fetchProfile` (`useAuth.tsx:56-60`) geeft bij elke fout `null` terug ("non-fatal" — verouderde aanname: het profiel draagt sinds cyclus 3b `methodology_id`, de spil van alle scoping). Bij een transiënte fout rendert de app met lege journals ("dataverlies"-schrikbeeld), en een trade die in dat venster gelogd wordt krijgt het WPM-systeemtemplate-id of `null` als journal — daarna voorgoed onzichtbaar. **Fix:** profielfout blokkerend maken (retry-scherm), mutaties weigeren zolang `profile == null`, TradeForm nooit een `is_system`-id laten stampen; flankerend een DB-ownership-check op `trades.methodology_id`.
- **N2 — GDPR-gat: account-verwijdering laat alle screenshots staan.** `delete_own_account()` (`schema.sql:626-631`) verwijdert geen Storage-objecten (bucket `screenshots` cascadet niet mee met `auth.users`), en nergens in de code bestaat een storage-delete: ook trade-delete en screenshot-vervangen laten orphans achter. Raakt de Terms/Privacy-beloften. **Fix (vóór launch):** storage-delete in `delete_own_account()`; daarna lifecycle (delete bij trade-delete of orphan-sweep).
- **N3 — Weekreview naar andere week/jaar bewerken herkoppelt trades niet.** Edit doet een kale UPDATE (`useWeeklyReviews.ts:50-55`; DB-triggers zijn insert-only) → de review toont blijvend de trades/KPI's/PDF van de oude week. **Fix:** bij gewijzigde jaar/week automatisch `linkTradesToReview` aanroepen (bestaat al, idempotent).

### Middel
- **N4** Weekly (link-based) vs. periodieke (date-based) stats kunnen elkaar tegenspreken; grotendeels opgelost door N3 te automatiseren.
- **N5** Prop-firm-drawdown meet vanaf 0 i.p.v. high-water mark → groene balk terwijl een trailing-account bijna breacht. Minimaal label expliciteren; beter `peak_pnl_pct` + trailing-berekening (sluit aan op trader-bevinding §8.10).
- **N6** Week 53 in een 52-weken-jaar: client valideert niet, handmatige relink linkt dan januari-trades van het vólgende jaar. Valideren tegen `isoWeekOf(jaar+"-12-28")`.
- **N7 → doorgeven aan open-trades-chat:** DB staat `is_open=true` + `trade_evaluation='Missed trade'` toe (logisch onmogelijke staat); check + formulier-gate.
- **N8 → doorgeven aan open-trades-chat:** journal-switcher-teller (`useJournals.ts:71-79`) filtert niet op `is_open` → telt straks anders dan de header.
- **N9** Import: ambigue mm/dd-datums worden stil day-first geraden → Amerikaanse CSV's krijgen verkeerde datums. Format-keuze vragen als alle eerste groepen ≤ 12; plus Date-roundtrip-check in `iso()`.

### Laag
- **N10** Fetch-fouten tonen rauwe PostgREST-tekst buiten `toErrorMessage` om (4 plekken). **N11** Migratienummer-register bijwerken (0043 = open trades; K1 = 0044; 0036 cherry-picken). **N12** "Avg RR"-label in reviews is geen R/R maar Ø per beslissende trade — hernoemen. **N13** `deleteJournal`: share-link sterft stil mee + actieve-journal-check alleen lokaal. **N14** `profiles_recompute_sessie` herschrijft synchroon alle trades bij settings-save. **N15** a11y: drie native `confirm()`-plekken + OnboardingWizard-overlay zonder focus-trap (de rest van de a11y-kern is verrassend goed).

**Schoon herbevonden in ronde 2:** fork/RLS, share-token-pad, ISO-week-algoritmes client+DB, kalenderwiskunde, adherence/breakdown/streak/PF-wiskunde, PDF-randgevallen, import-dedup-ontwerp, ErrorBoundary/Sentry-plaatsing, dependency-gebruik.

**Meta-les van ronde 2:** ronde 1 was sterk op happy-path en per-laag-volledigheid, maar de nieuwe fouten zitten op de *naden* — foutpaden, cross-system-consistentie (client vs. DB-triggers) en data-lifecycle buiten Postgres (Storage).

## 8. Feature-voor-feature-oordeel (pro-traderbril)

| Tool | Oordeel | Grootste gat binnen het tool |
|---|---|---|
| Trade-form | VOLDOENDE | geplande-R-veld ontbreekt; fees-veld ontbreekt; sanity-waarschuwing >±20% (open posities: loopt al elders) |
| Quick-log | VOLDOENDE | geen risk-veld (R-stats van scalpers kloppen niet), geen "bewaar & volgende", geen notitie/datum |
| Tradelijst | MAGER | zoeken negeert `instrument`+custom velden; kolommen WPM-gevormd (dode Concept/Entry, geen richting/R); geen sorteren/bulk |
| Kalender | GOED/MAGER | week- en maandtotalen ontbreken (hoogste winst per bouwuur van de app); dag-KPI-kop + trades-per-dag-teller |
| KPI-rij | VOLDOENDE | motor kan meer dan hij toont: SQN/std-dev, grootste win/verlies, gem. risico; drawdown-peak/trough berekend maar weggegooid |
| Breakdowns | GOED | kruistabellen alleen "per fase" (WPM) — generaliseren naar elk enum-veld; R-distributie-histogram ontbreekt; geen lage-n-badge |
| Equity curve | MAGER | underwater-curve + drawdown-duur ontbreken; peak/trough-markers bijna gratis |
| Reviews + PDF | GOED (beste tool) | acties-carry-over; adherentie/breakdown-blok in PDF; periode-vergelijk in periodieke reviews |
| Adherentie (N2) | GOED | drilldown naar onderliggende trades; trend over tijd; samenvatting als StatCard bovenaan |
| Prop-accounts | MAGER | trailing/EOD-drawdown-type ontbreekt (zie N5); consistency-reminder; account-groepen/totalen; reset-log; "laatst bijgewerkt"-stempel |
| Missed trades | hygiëne GOED, benutting MAGER | geen missed-analyse ("welke setups laat ik liggen") en geen reden-veld |
| Backtest-projecten | MAGER | periode/markt-metadata, parameternotities, status+conclusieveld, en vooral: projectvergelijking |
| Econ. kalender / lot-calc / screenshots / share / PWA / settings | VOLDOENDE-GOED | asset-gating kalender; "gebruik in trade"-brug lot-calc; vrije screenshot-labels; share-scope-keuze; offline-queue voor quick-log; account-verwijdering vindbaar maken |

**Top-3 ontbrekende functies die een pro het eerst mist:** (1) R-histogram + kruistabel op eigen velden, (2) projectvergelijking in backtesting, (3) echte prop-drawdown-typen + account-totalen.

---

*Bronnen: zeven audit-rapporten (ronde 1: code, security, trader, performance, launch; ronde 2: trader-verdieping, adversariële veegronde), 2026-08-20. Migratienummers: 0043 = open trades (andere chat), 0044 = eerstvolgend vrij (K1-fix claimt hem). Het geïntegreerde vervolgplan staat in `masterplan-2026-08.md`.*
