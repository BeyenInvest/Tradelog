# Masterplan naar launch — 2026-08-20 [GEARCHIVEERD]

> ⚠️ **Dit document is op 2026-08-27 vervangen door `masterplan-launch.md`** (alleen het resterende werk; alles wat af is, is daar weggelaten). Dit bestand blijft als historie/afvinklijst staan — niet meer bijwerken.

> **Dit document vervangt `stappenplan-verder-bouwen-2026-08.md` als leidend plan.** Het integreert (1) de volledige audit van 2026-08-20 (`audit-en-launchplan-2026-08.md`, ronde 1 + 2) met (2) het bestaande letterfase-plan. Werkwijze per fase ongewijzigd: eigen branch → bouwen → lint/test/build groen → review met owner → commit/push alleen op expliciet verzoek; migraties via `scripts/run-migration.mjs`, owner draait, read-only verifiëren.
>
> **Vaste besluiten blijven staan:** geen eigen replay/chart-engine ooit; TradingView is king; differentiatie = methodiek-condities + presets + eerlijke statistiek; alles nieuws achter `beta_features` tot de flip.

## Stand van zaken (geverifieerd — bijgewerkt 2026-08-26)

> Prod = `origin/main` @ `fb440da`, migraties t/m **0051**. Eerstvolgend vrij migratienummer: **0052**.

**De hele beta-scope (G-rest + S1 + I + N-rest) is code-compleet en live op prod.** Bovendien zijn S2 sessie 1 + 2 al vooruitgetrokken (zouden ná de beta komen).

- **Af en live:** H, G, J, K, L, M, open posities (0043), **Q** (0044), **R** (0045/0046), **I** (import-praktijktest op echte FTMO-statement), **N1** (ICT/SMC-startsets), **N2** (adherentie, un-gegate), **N3** (MAE/MFE + exit-analyse, 0049), **N5** (review-secties, 0048, beta-gated), **G-rest A1–A4** (preset-builder, label-vertaalbaarheid 0047, journal-overzicht), **G-rest B1–B4** (beta-flip, support-link, account-delete, Terms/Privacy-teksten), **S1** (trader-polish), exit-analyse+SQN opt-in (0050), **S2 s1** (tijd_open/sessie-uur, 0051), **S2 s2** (R-histogram + kruistabellen, un-beta-gated).
- **Nog te doen vóór beta (niet-code / geblokkeerd):** **B5** landing page (wacht op designer-logo + PWA-iconen), **B6** launch-week owner-ops, juridische review Terms/Privacy.
- **Bewust ná de beta:** weekly digest e-mail (eerste na launch), S2-restant, post-launch-register (discipline-pack, trade-plan, AI-laag, share-cards), O (monetisatie), P (opruiming/schaal).

## Volgorde

**Q ✅ → R ✅ → G-rest (B5 logo-geblokkeerd) + launch-week (owner) → S1 ✅ → T (audit-fixes 2026-08-27) → 🚀BETA → S2 (deels al af) → N-rest ✅ → O → P**

Q en R waren de poortwachters (beide af). De beta wacht op het **designer-logo** (voor de landing), de **owner-launchweek** én — sinds de audit van 2026-08-27 — **Fase T** (zie hieronder): een klein fixblok dat precies in de logo-wachttijd past.

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
| T — audit-fixes 2026-08-27 | T1 (migratie 0052 + datalaag/import/stats) **Fable** · T2 (UI/product) **Opus** · T3 (docs/hygiëne) **Opus** |
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

### Migratie-register (N11 — bijgewerkt 2026-08-26)

Volgorde van de recente/relevante migraties en hun status op prod. Eerstvolgend vrij nummer: **0052**.

| Nr | Bestand | Wat | Status prod |
|---|---|---|---|
| 0036 | `revoke_anon_execute` | anon EXECUTE per naam intrekken op alle RPC's + admin-policies `to authenticated` | ✅ gedraaid (2026-08-13) |
| 0043 | `open_trades` | lopende trades (is_open) | ✅ gedraaid (2026-08-20) |
| 0044 | `audit_hardening` | K1 kolom-grants + N1 ownership-trigger + N2 storage-delete | ✅ gedraaid |
| 0045 | `rename_field_option` | transactionele option-rename-RPC (Fase R s1, M5) | ✅ gedraaid |
| 0046 | `admin_methodology_select` | is_admin() SELECT op methodologies + methodology_fields (Fase R s2, H2) | ✅ gedraaid (2026-08-22) |
| 0047 | `field_label_keys` | label_key/group_key op methodology_fields + render-time-vertaling (Fase G-rest A3) | ✅ gedraaid (2026-08-24) |
| 0048 | `review_sections` | configureerbare review-secties per journal + content jsonb-bag + get_shared_review-uitbreiding (Fase N5) | ✅ gedraaid |
| 0049 | `mae_mfe` | MAE/MFE + planned_rr + open-trade-check (Fase N3) | ✅ gedraaid (2026-08-24) |
| 0050 | `methodology_track_exit` | exit-analyse + SQN als per-journal opt-in | ✅ gedraaid |
| 0051 | `tijd_open` | `tijd_open` + sessie/uur op echte tijd-as (Fase S2 s1) | ✅ gedraaid |

> Eerstvolgend vrij nummer na 0051: **0052**.

## Fase G-rest + launch-week (owner-ops + klein code)

Zoals het oude plan, aangevuld vanuit de audit:

1. **Beta-flip** (code): onboarding-wizard + de "iedereen moet dit"-set uit de gate, óf `beta_features` default aan — zonder dit landt elke nieuwkomer nog in het WPM-jargonformulier. Preset-catalogus meteen opschonen (WPM-preset als "gevorderd" labelen, groeperen per asset-class; wizard-"Overslaan" alleen stap 1).
2. Support-contactlink + account-verwijdering vindbaar maken (code, klein).
3. Terms/Privacy juridisch → teksten erin (owner + code).
4. Landing page op `/` (goedgekeurde mockup → React) — ná designer-logo; PWA-iconen (owner/designer + code). **Positionering t.o.v. Create Impacts verwerken** (zie §Concurrentie-besluiten): volwaardig journal gratis, meerdere journals, %/R/$-weergave, screenshot-upload, open trades.
5. Launch-week owner-ops in volgorde: Turnstile → Supabase URL-config → e-mailtemplates + custom SMTP → Sentry-DSN + uptime-monitoring + DB-backupregeling → signup-toggle aan → smoke-test met vers account. *Na Turnstile: geen Browser-pane meer op prod zonder overleg.*

**Klaar wanneer:** een vreemde meldt zich aan en overleeft de eerste 10 minuten — nu met de zekerheid dat Q/R eronder waterdicht zijn.

## Fase S — Trader-polish & verdieping (uit de feature-inspectie)

### S1 — vóór launch (klein, hoge zichtbaarheid, ~1 sessie)
1. **Kalender: week- en maandtotalen + dag-KPI-kop in DayTradesModal** (hoogste winst per bouwuur; data ligt klaar in `byDay`).
2. **Quick-log pro-klaar**: risk-veld (onthouden), "bewaar & volgende", notitieregel, datumkeuze; quick-log als zichtbare primaire knop.
3. **Invoerfrictie**: outcome overal afleiden uit het teken (patroon bestaat in quick-log); laatst-gebruikt instrument onthouden; sanity-waarschuwing bij >±20% resultaat. *(Invoer in %/R/geld: afstemmen met de open-posities-chat, raakt hetzelfde formulier.)*
4. **KPI-motor afmaken**: grootste win/verlies, gem. risico per trade, SQN/std-dev als StatCards; drawdown-peak/trough-markers op de equity curve.
5. Tradelijst: kolommen journal-bewust (richting/R i.p.v. dode Concept/Entry-kolommen), sorteren op resultaat.

### S2 — verdieping (deels al vóór de beta vooruitgetrokken en live)
1. ✅ **R-distributie-histogram + kruistabellen op eigen enum-velden** (setup × sessie) — af + un-beta-gated (`fb440da`).
2. **Underwater-curve + drawdown-duur**; equity optioneel op tijd-as.
3. **Dag-laag**: dagnotitie + day-win-rate e.d. (kalender wordt einde-dag-ritueel).
4. ✅ **`datum_open` → datetime** + sessie/uur-breakdown via `profiles.timezone` — af (`tijd_open`, 0051).
5. **Acties-carry-over** in weekly review + adherentie/breakdown-blok in de PDF + periode-vergelijk in periodieke reviews.
6. **Adherentie**: drilldown naar trades, trend per week, samenvattings-StatCard bovenaan.
7. **Missed-trades-analyse** (hypothetisch gelabeld, buiten echte KPI's) + reden-veld.
8. **Prop-accounts v2**: `drawdown_type` static/trailing/EOD + peak-invoer, consistency-reminder, account-totalen ("payout YTD"), reset-log, "laatst bijgewerkt"-stempel.
9. **Backtest-projecten v2**: periode/markt-metadata, parameternotities, status + conclusieveld, projectvergelijkings-view (RPC levert cijfers al).
10. **Multi-select-veldtype** + breakdown; **CSV-export**; share-scope-keuze (stats-only vs. incl. notes); offline-queue voor quick-log; lot-calc "gebruik in trade"-brug; econ. kalender asset-gaten; vrije screenshot-labels.

## ✅ Fase I-praktijktest (AF — vastgesteld 2026-08-24, uitgevoerd 2026-08-18)

MT4 gevalideerd op echte FTMO-statement + echt geïmporteerd (aparte journal), alles op main/prod (`1c34877`); N9 zat in R sessie 1; TV/cTrader gehard maar bewust zonder owner-validatiepad (owner exporteert alleen uit MetaTrader). Van de geparkeerde punten A/B/C rest alleen **B** (fictieve-R-markering bij imports zonder risk%) → meenemen in N3. Details: `docs/fase-G-rest-handoff.md` §D.

## Fase N-rest (bestaand)

- **N-1** Meer presets (ICT/SMC, breakout, mean-reversion, opties-wheel).
- ✅ **N-3** MAE/MFE + `planned_rr` + exit-analyse (2026-08-24, Fable) — migratie **0049**; incl. geparkeerd punt B (fictieve-R-markering "~" bij aangenomen 1%-risico). Details: `docs/fase-G-rest-handoff.md` §E.
- **N-5** Review-secties configureerbaar per journal.

## Concurrentie-besluiten — audit Create Impacts (2026-08-24)

Volledige audit: `docs/concurrentie-audit-createimpacts-2026-08.md` (createimpacts.eu, ex-Archer-client, Belgisch, commercieel live op €19/29 met AI-coach "Gauthier"; zelfde Supabase-fundament en Archer-DNA). Kernconclusie: **wij sterker op de engine, zij op productisering.** Owner-besluit ("ok", 2026-08-24): **beta-scope blijft ongewijzigd — tempo weegt zwaarder dan nieuwe features.** Wat wél verandert:

1. **%→$-weergave: géén nieuw werk** — bestaat al (Fase J: opslag in %, weergave-toggle %/R/$ via `useResultDisplay` + saldo actieve prop-account, sinds beta-flip open). Actie beperkt zich tot zichtbaar maken op de landing/feature-lijst.
2. **Direct ná beta-launch: weekly digest e-mail** — wekelijkse stats + focuspunten per mail; stats-motor bestaat al, nodig is alleen Supabase cron/edge + mailprovider. **Fable** (infra/cron) + Opus (inhoud/opmaak). Goedkoopste retentie-win; hun Weekly Edge Digest bewijst het concept.
3. **Post-launch-register (S2/O-tijdvak, niet eerder):**
   - **Discipline-pack als preset-veld-pack** (emotie vóór/na, gedrags-tags als Revenge/Overtrading/Broke rules, optionele pre-trade checklist) — configureerbaar in onze bouwsteen/startset-structuur, níet hardcoded zoals bij hen.
   - **Trade-plan-builder/-koppeling** — meenemen bij toekomstig onboarding/preset-werk (onze condities/criteria zijn structureel al het halve werk).
   - **AI-laag** — blijft post-launch; sterkste leen-idee: plan-PDF-extractie → regels → plan-compliance % per trade. Onze gestructureerde per-journal-data is een beter substraat dan hun vrije tekst.
   - **Share-cards/streaks** — growth-mechanics, horen bij marketing/P-tijdvak.
4. **Pricing-validatie:** €19/29 werkt in de Benelux; free tier gul houden ("volwaardig journal gratis") tegenover hun 20-trades-totaal-teaser.
5. **Niet kopiëren:** verplichte plan-keuze vóór gebruik, trades-totaallimiet in free, URL-screenshots i.p.v. upload.
6. **Waarschuwing bevestigd:** hun hernoemde-UI-op-legacy-kolommen-schuld = extra argument om cyclus 10 (WPM-kolommen droppen, Fase P) niet te laten verwateren.

## Fase T — Audit-fixes 2026-08-27 (vóór de beta; past in de logo-wachttijd)

Bron: `docs/audit-2026-08-27.md` (2 rondes, 12 agents; ronde 2 verifieerde ronde 1 adversarieel — 0 items weerlegd). De rekenmotor is numeriek geverifieerd correct (31/31), er is geen backtest↔live-lek en geen cross-tenant-datalek voor ingelogde gebruikers; wat rest is onderstaand fixwerk.

### T1 — Fable (datalaag/security/stats, ~1-2 sessies) — *eerst dit*
1. **Migratie 0052** (owner draait via de vaste runner, daarna read-only verificatie + test dat een review-share geen open trades meer levert):
   - `get_shared_review` hercreëren mét `and not t.is_open` in beide trades-subqueries (S2-1, HOOG — 0048-regressie);
   - `is_open` én `tijd_open` toevoegen aan `shared_trade_json` (tweede verdedigingslinie + M5-a);
   - anon-EXECUTE-revoke op `compute_sessie_at` (0036-conventie);
   - composiet-index `trades(user_id, methodology_id, datum_open)` (bestond nergens — ronde 2 bevestigde dit definitief);
   - conventie-comment bovenin: share-RPC's altijd hercreëren vanaf de láátste versie.
2. **C2** quick-log `is_system`-guard (1 regel — zonder dit kan een vers skip-account geen quick-log opslaan) + **C1** `profileError` alleen fataal zonder geladen profiel (2 regels — voorkomt app-brede foutschermen bij een token-refresh-hikje).
3. **B1** admin-Analyse op journal scopen; **B2** extremen-kaart correct in R-modus.
4. Import-robuustheid: **P-exp** exponentnotatie in `parseNumber` (stille corruptie) + **B4** `datum_sluiting >= datum_open`-guard. Daarna is de import volgens de fuzz-audit un-gate-klaar (owner-besluit).
5. **M1-a** review-relink bij datum-wijziging + **M1-b** review-form gaten op sections-loading (dataverlies-klasse); **M4-a** journal-aanmaak atomair (RPC) — vóór de signup-toggle.
6. **P1** mutatie-patching in `useTrades` (lost meteen het C4-duplicaatrisico grotendeels op).
7. Tests: kalendertotalen-logica naar `src/lib/` + tests (T1), `localDate.ts`-tests (T2).

### T2 — Opus (UI/product, ~1 sessie)
1. **UX-A/B** fase-kolom verbergen voor moderne journals + `columnMode` in ReviewTradeGroups (het WPM-lek dat elke nieuwe gebruiker ziet).
2. **UX-C** kruistabel-default = eerste dimensie mét data (ook voor beta-accounts met alleen historische trades).
3. **UX-D** `tijd_open`-invoerveld un-gaten + optioneel tijdveld in quick-log.
4. **P2** periodieke SW-update-check (PWA staat voor iedereen aan).
5. **M2-a** actief-toggle op prop-accounts (geld-modus leunt erop); **M4-b** dode startset-combinaties uitgrijzen.
6. **Analyse-defaults**: eerste bezoek = KPI-rij + equity open, rest ingeklapt; "Series van 5" default dicht. → **Vuistregel vanaf nu (BINDEND): elke nieuwe analyse-sectie landt default-ingeklapt en/of achter een per-journal-opt-in (0050-patroon) — nooit meer default-open erbij.**
7. Klein: "win rate"-string i18n, stale gating-comments (TradeJournalView/BacktestingAnalysisView/vite.config), Settings-"Trading"-sectie legacy-only, C5 loading-gate op de Analyse-tab.

### T3 — Opus (hygiëne, ~½ sessie)
Masterplan-diff committen; CLAUDE.md/README-drift (4+3 stale punten, zie audit §5); oude handoff-docs archiveren; branch-opruiming (~28 gemergde branches + stash-check, met owner-akkoord); C6 try/catch om `lang`/`theme` + userId in tradeMemory/pairMap-keys.

### Ná launch (verzamelwerk, geen blockers)
Eén hardening-migratie: vijf uuid-bestaans-oracles (0044-triggerpatroon op reviews/prop_accounts/show_when_field_id), jsonb-/lengte-CHECKs (S2-5), anon-revoke op preset-tabellen, `base-uri`/`form-action` in CSP, `account_size > 0`-CHECK. Verder: C3 profiel-refetch op focus, M3-a per-project import-dedup, offline-banner (M7-a), histogram-halfronding, B3/B5/B6/B7, schema.sql weer volledige bootstrap maken (S2-2), font-preconnect, search-debounce, `date-fns` verwijderen, equity-downsampling + `React.memo` om charts. Formula-escaping is een harde eis zodra ooit een CSV-export gebouwd wordt.

## Fase O — Monetisatie (beslismoment owner, ongewijzigd)

Freemium-gate op `profiles.plan` (nu ook echt afdwingbaar dankzij de K1-fix — vóór die fix was elke plan-limiet omzeilbaar); Stripe pas als owner het aankaart.

## Fase P — Opruiming & schaal (ongewijzigd, aangevuld)

Cyclus 10 (WPM-kolommen droppen); server-aggregatie pas bij echte >10k-users (samen met list-paginering); N14 (`profiles_recompute_sessie`-batching) en TradeList-virtualisatie horen hier.

---

## Bewust nooit / nog niet (ongewijzigd)

Geen replay/chart-engine, geen AI-laag (nog — post-launch-kandidaat, zie §Concurrentie-besluiten punt 3), geen community, geen live broker-integratie. Partials/scale-outs: bekende grens, niet bouwen tot import het afdwingt.

## Direct volgende stap — concrete weg naar de beta (bijgewerkt 2026-08-26)

De beta-scope is code-compleet, maar de audit van 2026-08-27 voegde **Fase T** toe (klein fixblok, past in de logo-wachttijd). Volgorde:

1. **Fase T1 (Fable)** — migratie 0052 (review-share-lek!) + de C1/C2-éénregelfixes + datalaag; owner draait 0052. *Dit eerst — het lek staat op prod.*
2. **Designer-logo + PWA-iconen** (owner/designer) — de harde blokkade voor de landing; loopt parallel aan T.
3. **Fase T2 + T3 (Opus)** — UI-fixes, analyse-defaults, docs/branch-hygiëne.
4. **B5 — Landing page** op `/` (Opus, zodra logo er is): goedgekeurde mockup → React; positionering t.o.v. Create Impacts verwerken (volwaardig journal gratis, meerdere journals, %/R/$-weergave, screenshot-upload, open trades).
5. **Juridische review** Terms/Privacy (owner) — aanbevolen; niet blokkerend voor een gratis beta, wél vóór Stripe/betaalde launch.
6. **B6 — Launch-week owner-ops** in deze volgorde: Turnstile-site → Supabase URL-config → e-mailtemplates + custom SMTP → Sentry-DSN + uptime-monitoring + DB-backupregeling → "Allow new users to sign up" aan (pas ná T1's M4-a) → smoke-test met vers account. *Ná Turnstile: geen Browser-pane meer op prod zonder overleg.*
7. 🚀 **Beta-launch.**
6. **Direct erna:** weekly digest e-mail (Fable infra + Opus inhoud), daarna S2-restant / post-launch-register / O / P naar behoefte.

> **Check bij launch:** PWA-service-worker registreert sinds de beta-flip (B1) origin-wide voor iedereen — verifieer update-gedrag met een vers account.
