# Stappenplan — verder bouwen (v.a. 2026-08-13)

> **Bron:** samenvoeging van (1) de [concurrentie-analyse](concurrentie-analyse-2026-08.md), (2) het restant van het [launch-stappenplan](stappenplan-launch-gereedheid.md) (Fase G), (3) de geparkeerde punten uit dat doc, (4) de resterende cycli uit het [ontwerpdoc](ontwerp-configureerbaar-journal.md) (8, 9, 10) en (5) de memory-wachtlijsten (import-verbeteringen, onboarding-wizard).
> **Werkwijze per fase (ongewijzigd):** eigen branch → bouwen → `npm run lint` + `npm run test` + `npm run build` groen → review met owner → committen/pushen alleen op expliciet verzoek. DB-migraties via `scripts/run-migration.mjs` + `SUPABASE_DB_URL` — owner draait ze, daarna read-only verifiëren.
> **Vaste besluiten die dit plan stuurt:** géén eigen replay/chart-engine, ooit (TradingView is king — Beyen = analyse-laag erbovenop); differentiatie = methodiek-condities + presets + statistische eerlijkheid; free tier = compleet werkend journal, premie op hoeveelheid + customisatie.
> Volgorde = prioriteit: eerst launch (H+G), dan de gaten uit de analyse op impact × haalbaarheid, dan verdieping.

---

## Fase H — Huis op orde (½ sessie, geen migraties) — *eerst dit*

1. **Fase F mergen naar main** — branch `fase-f-reviews-ont-wpm` (commits aa5a417 + 7e71843) is klaar en groen, maar nooit gepusht/gemerged. Fast-forward push zoals bij B/C+D+E.
2. **Docs committen** — `concurrentie-analyse-2026-08.md` en dit stappenplan zijn untracked; toevoegen zodat de plannen in het repo leven (alleen eigen bestanden stagen, gedeelde worktree).
3. **Stale branches opruimen** (optioneel, met owner): de gemergde `fase-a`…`fase-e`-branches lokaal/remote verwijderen.

**Klaar wanneer:** main bevat Fase F + beide docs; `git branch` is weer leesbaar.

---

## Fase G — Launch-checklist (grotendeels owner-ops, samen doorlopen)

Onveranderd uit het vorige stappenplan; hier alleen de status:

1. Turnstile + Supabase CAPTCHA her-activeren (README §5) — ⚠️ daarna Browser-pane niet meer op de app zonder overleg.
2. Supabase: signup-toggle aan, URL-config, e-mailtemplates.
3. Terms/Privacy juridisch (laten) reviewen — nu placeholder.
4. **Landing page op `/`** — enige code-deliverable; **wacht op designer-logo**. Nieuw uit de analyse: de page moet de methodiek-differentiator verkopen ("jouw methodiek als invulbaar formulier", eerlijke statistiek), niet "nóg een journal". Free tier prominent (bewezen funnel — Tradervue/TradesViz-les).
5. `beta_features` flippen (of default true).
6. Smoke-test vers account: signup → onboarding → preset → eerste trade → analyse → review.

**Klaar wanneer:** een vreemde kan zich aanmelden en de eerste 10 minuten overleven.

---

## Fase I — Import-fundament (2-3 sessies) — *grootste gat uit de analyse*

Elke serieuze concurrent importeert automatisch; bij ons is zelfs de gebouwde MetaTrader-CSV-import geparkeerd. Dit bepaalt wie klant kán worden, en het is de voorwaarde voor de TradingView-strategie (analyse §4C).

1. **MetaTrader-import activeren** — ligt klaar (branch `fase-2-scale-import`-lijn); eindelijk testen met een echte CSV van de owner. Heropent meteen de geparkeerde trader-verbeteringen A/B/C (memory "Import-workflow geparkeerd").
2. **TradingView paper-trading-export** als tweede bron — de owner backtest in TradingView; de export-CSV importeren = "Beyen als analyse-laag bovenop TradingView" concreet gemaakt. Mapper generaliseren (symbol → instrument + asset_class, ontwerpdoc §5 is al gebouwd in Fase D).
3. **FX Replay-export** als derde bron (zelfde mapper, lage meerkost) — optioneel.
4. **Import-UX:** duidelijke fouten, preview vóór commit, dedupe (zelfde trade twee keer importeren mag niet dubbel tellen), toewijzing aan journal + account bij import.

**Klaar wanneer:** een echte MetaTrader- én TradingView-CSV komen er in één keer goed in, backtest-trades landen in een backtest-project, en dubbel importeren is onschadelijk.

---

## Fase J — Geld/R als resultaat-eenheid (2 sessies, migratie) — *ontwerpdoc cyclus 8*

Grootste doelgroep-verbreder (vrijwel iedereen toont geld-P&L primair; wij zijn %-only).

1. Per-user `result_unit` (`percent | R | currency`) op `profiles` — stats-motor blijft intern in % rekenen (contracten intact), de *weergave* converteert (ontwerpdoc §6).
2. R is al afgeleid (`rMultiple()`) — R-weergave is de goedkope eerste stap.
3. Geld vereist bedrag-per-trade of account-saldo-koppeling — beslis de bron; de geparkeerde **account↔trades-koppeling** (auto-P&L op prop-accounts) kan hier meeliften of direct ná.

**Klaar wanneer:** dezelfde KPI-rij en curves tonen in %, R of € naar keuze, zonder dat één stats-test wijzigt.

---

## Fase K — Screenshot-upload (1-2 sessies) — *QoL-#1, dicht 80% van het auto-chart-gat*

1. Supabase Storage-bucket (per-user RLS) + upload/paste-from-clipboard in het trade-formulier — vervangt/naast de vier URL-velden.
2. De "vrije screenshot-lijst" uit het ontwerpdoc (cyclus 5-restje): n screenshots met label i.p.v. vier vaste WPM-timeframe-slots.
3. Lightbox/preview in trade-detail en review.

**Klaar wanneer:** Ctrl+V van een TradingView-chart in het formulier werkt en toont in detail + PDF.

---

## Fase L — Mobile-instap: PWA + quick-log (1-2 sessies)

TraderSync/UltraTrader zetten hier de standaard; wij bouwen géén native app.

1. PWA-manifest + service worker (installeerbaar, icon = gold shield).
2. **Quick-log-formulier**: minimale velden (instrument, richting, resultaat, evaluatie) voor loggen direct na de sessie; details later aanvullen. Bedient meteen de geparkeerde scalper-wens (duplicate-trade/quick-add).

**Klaar wanneer:** app installeerbaar op telefoon en een trade is in <30 sec gelogd.

---

## Fase M — Coaching & sharing (1-2 sessies)

Kleine bouwsteen, groot effect voor de coaching-niche (analyse §2.8/§3.3).

1. **Read-only share-link** voor een journal of review (token-URL, RLS-veilige view of edge function) — voorbij de PDF.
2. Later/optioneel: geverifieerde publieke track-record-pagina (Myfxbook-idee, maar methodiek-bewust).

**Klaar wanneer:** owner kan een coach een link sturen die zonder account het journal read-only toont.

---

## Fase N — Methodiek-verdieping (doorlopend, per stuk 1 sessie)

Onze kern-differentiator uitbouwen (analyse §4A):

1. **Meer presets** in de bibliotheek: ICT/SMC, breakout, mean-reversion, opties-wheel, … (journal-presets.md uitbreiden + seeds).
2. **Regel-adherentie-analyse**: "wat kost afwijken van je eigen condities?" — koppel `trade_evaluation` (Emotional/Technical error) en veld-waarde-combinaties aan P&L-verschil (Edgewonk/RizeTrade-les, maar over ónze custom velden).
3. **MAE/MFE** (uit spec §7-8 halen zodra import loopt): twee optionele kolommen (invulbaar of uit CSV) + exit-analyse-rapport.
4. **Onboarding-wizard** (longlist-memory): first-run naam + timezone + preset-keuze — hergebruikt PresetChooser.
5. **Review-secties configureerbaar per journal** (Fase F "later"-variant, zelfde patroon als methodology_fields).

---

## Fase O — Monetisatie (beslismoment owner)

1. **Freemium-gate** (ontwerpdoc cyclus 9): `profiles.plan` afdwingen in de UI — limieten op aantal journals/custom velden, gratis laag blijft compleet. Geen migratie, laag risico.
2. Stripe/billing — bewust out of scope tot de owner het aankaart (CLAUDE.md); de gate uit punt 1 is de voorbereiding.

---

## Fase P — Opruiming & schaal (pas als soft-launch stabiel draait)

1. **Cyclus 10**: WPM-kolommen droppen, alles dynamisch — lost `isLegacyMethodology` + placeholder-vervuiling op. Destructief: bewezen migratie + backup-branch verplicht (ontwerpdoc §10).
2. Refetch-na-mutatie → lokale cache-update (performance bij grote imports — relevanter zodra Fase I loopt).
3. Server-aggregatie (roadmap Fase 2) bij echte datavolumes.
4. Accounts/reviews empty-states (klein restje uit de geparkeerde lijst).

---

## Bewust nooit / nog niet

- **Eigen bar-replay/chart-engine — nooit** (owner-beslissing 2026-08-13; TradeZella's replay zelf ervaren als onbruikbaar, TradingView is king). Import (Fase I) is het antwoord.
- **AI-laag — nog niet**: pas als de gestructureerde custom-velden-data volume heeft; dan is "Edge Finder over jouw methodiek-velden" een sterkere story dan generieke chat-over-je-trades (analyse §4C).
- **Eigen community** naast Myfxbook — hooguit community-presets als lichte netwerk-play, later.
- Live broker-integratie / real-time (Journalytix-territorium), Google Sheets-migratie: ongewijzigd out of scope.

---

## Volgorde-samenvatting

**H** (huis op orde) → **G** (launch) → **I** (import) → **J** (geld/R) → **K** (screenshots) → **L** (PWA) → **M** (sharing) → **N** (methodiek-verdieping, doorlopend) → **O** (monetisatie, beslismoment) → **P** (opruiming/schaal).

I t/m L zijn de vier gaten uit de concurrentie-analyse op impact-volgorde; N is het uitbouwen van wat we al winnen. Elke fase is zelfstandig deploybaar; niets erin vereist een replay-engine, een native app of een AI-model.
