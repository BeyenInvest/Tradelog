# Concurrentie-audit — Create Impacts (createimpacts.eu) vs. Beyen — augustus 2026

> **Aanleiding:** ex-Archer-client heeft een journal gebouwd dat sterk op Beyen lijkt. Owner logde in op een free account; deze audit is een volledige doorlichting via de live app (2026-08-24), netwerkverkeer en pricing/marketing-site — afgezet tegen Beyen (main, 2026-08-24).
> **Methode:** passieve observatie van het eigen free account (UI + eigen netwerkverkeer). Er is **niet** aan hun beveiliging geprikt (geen RLS-tests, geen endpoints aangeroepen buiten wat de app zelf doet).

---

## 0. Wie zijn ze

- **Create Impacts** — Belgisch bedrijf (KBO BE0799405506), tagline *"Track your trades. Master your mind."*
- Forex/prop-firm-publiek (voorbeeld-pairs EURUSD/GBPUSD/XAUUSD..., accounts-framing "FTMO, FundedNext, personal capital").
- **Archer-DNA is onmiskenbaar**: trade concepts, blueprints, daily/4H-patterns, criteria (LCC/zone/fib/market structure), 4 screenshot-timeframes, backtest-projecten, weekly review. Zelfde afkomst als onze legacy-WPM-velden — dit is in feite "Beyen gebouwd door een andere Archer-student".
- Volwaardige commerciële site: landing, features, blog, FAQ, gratis SEO-tools (position size- en pip-calculator), Terms/Refund/Privacy, GDPR-claim.
- **Pricing:** Free (20 trades totaal, 1 account) / Pro €19/mnd / Elite €29/mnd, 14 dagen Pro-trial, maand & jaar. AI-coach is de upsell-ruggengraat (Pro 20 chat-berichten/dag, Elite 100 + deep-dive-rapporten + founder-toegang).

## 1. Engine (tech-laag)

| Onderdeel | Create Impacts | Beyen |
|---|---|---|
| Frontend | React + **TanStack Start** (SSR, file-based routes) + Vite, shadcn/ui + Tailwind, TanStack Query, lucide, i18n-laag | React + Vite + TS + Tailwind, eigen componenten, TanStack Query |
| Backend | **Supabase** (auth + PostgREST rechtstreeks vanuit client, `has_role`-RPC, RLS verondersteld) | **Supabase** (identiek patroon) |
| Datamodel | Hardcoded Archer-kolommen op `trades` (criteria_lcc/zone/fib/ms, blueprint, daily/h4_pattern, screenshot_monthly→h4, emotion_pre/post/intensity/tags, plan_id, risk_pct, profit_pct, is_backtest + backtest_project_id) + `trade_accounts`-junction (één trade → meerdere accounts, per-account profit_pct) | Universele kern + `methodologies`/`methodology_fields` (journals met eigen velden), legacy-WPM-kolommen tot cyclus 10, `custom_options` |
| Resultaat-eenheid | **% als source of truth, $ afgeleid** van startkapitaal per gekoppeld account; weergave-toggle %, $, of beide | Zelfde filosofie, al gebouwd (Fase J): opslag in %, weergave-toggle **%/R/$** via saldo actieve prop-account (`useResultDisplay`); volledige geld/R-invoer = cyclus 8 |
| Stats | R-multiple, expectancy, plan-compliance %, discipline score (instelbare gewichten + lookback), per-pair/per-setup breakdowns, equity | Expectancy, profit factor, streaks (BE-pauze-regel), drawdown + markers, equity, per-dimensie breakdowns, missed-trade-integriteit via `isMissed()` |
| AI | **Gauthier**: chat-coach met persistent geheugen, plan-PDF-upload + regel-extractie, plan-aware trade-reviews, pre-trade contextual check, AI-backtest-review, wekelijkse focus-mails, EN/NL/FR/DE | Geen |
| Import | Excel-import (Pro), export CSV + JSON | TV/generic CSV-parser gebouwd (branch, geparkeerd); screenshots-upload live |
| Ops/growth | GA4 + FB Pixel + **server-side Conversions API** + eigen analytics- en web-vitals-endpoints; e-mail-cadans (weekly digest, monthly deep dive) | Geen analytics, geen e-mail |
| Billing | Stripe-achtig met plans/trial live; `PaymentTestModeBanner` in de bundle (betalingen (deels) in testmodus!) | Nog niets (bewust, beta) |

**Engineering-observaties (hun zwaktes):**
- `week`/`month`/`year` als aparte kolommen op `trades` — denormalisatie van iets dat uit de datum volgt.
- Screenshot-kolommen heten `monthly/weekly/daily/h4` maar de UI-slots zijn hernoemd naar 1H/15m/5m/1m → **zij hebben nu al legacy-kolom-schuld**, precies ons `isLockedLegacyField`-probleem.
- Mixed NL/EN-strings in de EN-UI ("Plan gevolgd", "optioneel", "bv. 1.0") — geen i18n-review-pipeline.
- Rechtstreekse PostgREST-koppeling lekt het volledige schema via query strings (normaal bij Supabase, maar hun business-logica zit in de client).
- Geen trade-richting (long/short), geen entry/exit-prijzen, geen SL/TP in het schema — alles is zelfgerapporteerd %.
- Free account moet éérst expliciet "een plan kiezen" vóór er ook maar iets werkt — onboarding-frictie.

## 2. Workflow (trader-laag)

Hun dagelijkse lus is bewust **gewoontevormend** opgebouwd:

1. **Zondag**: "Sunday Market Breakdown" — wekelijks voorbereidingsritueel (story-formaat briefing, eigen streak).
2. **Vóór de trade**: optionele Pre-Trade Checklist (5 disciplinevragen vóór je een live trade mag loggen).
3. **Loggen** (±30 sec): datum, pair, result, profit %, risk %, plan-koppeling, account-chips, 4 screenshot-URL's, emotie vóór/na + intensiteit 1-5 + gedrags-tags (Plan followed, Revenge trade, Overtrading, Chased entry, Broke rules...), notes.
4. **Wekelijks/maandelijks**: review met vaste vragen ("What stories were playing this period?", "Technical vs mental mistakes?") + **review-streaks**; missed trades apart loggen "so you can spot patterns later".
5. **E-mail**: Weekly Edge Digest (zaterdag/zondag) met stats + focuspunten; Elite krijgt maandelijkse deep-dives.
6. **Delen**: kant-en-klare social cards (streaks, discipline score) voor Instagram/X/Discord — growth-loop.

Configuratie zit in één "Data Set-up"-scherm: trading-style-presets (Swing/Day/Scalper/Futures/Crypto) die timeframes/criteria/pairs omzetten, hernoembare categorieën met value-lijsten + multi-select-toggle, custom categorieën, instelbare emoties/tags/screenshot-slots, en de %/$-weergavekeuze.

## 3. Wat doen ze goed

1. **AI-coach als product, niet als gimmick** — plan-PDF → geëxtraheerde regels → plan-compliance % per trade → pre-trade check → wekelijkse focus-mail. Dat is een samenhangende coaching-lus en tegelijk hun volledige upsell-verhaal (Free→Pro→Elite verschilt vooral in AI-toegang).
2. **Psychologie-laag**: emoties vóór/na, gedrags-tags, discipline score met instelbare gewichten, checklist. Ze meten *indiscipline* — de echte faalfactor van retail traders — niet alleen uitkomsten.
3. **Retentie-mechanics**: streaks overal (journaling, weekly/monthly review, plan-followed, SMB), e-mail-cadans, share-cards. Beste-in-klasse habit design voor een indie-journal.
4. **Commerciële uitvoering**: heldere pricing met trial, refund policy, KBO/GDPR, blog + gratis calculators voor SEO, meertalig. Ze zíjn gelanceerd.
5. **%→$-afleiding**: % als bron, $ als weergave via startkapitaal per account — elegante oplossing voor het geld-vraagstuk, plus prop-firm multi-account (één trade op meerdere accounts).
6. **Polish**: consistente shadcn-look, verzorgde empty states en 404, licht/donker, per-icoon code-splitting, kolom-configuratie + "search anything" op de tradelijst.

## 4. Wat kan bij hen beter (onze kansen)

- **Eén setup per gebruiker** — geen journals. Wie twee strategieën draait (of live vs. funded met andere regels) kan niet scheiden wat wij per journal isoleren. Dit is ons grootste structurele voordeel.
- **Screenshot-URL's i.p.v. upload** — wij hebben upload al live (Fase K). Hun "Charts"-kolom is een linkje naar TradingView-URL's.
- **Geen prijzen/richting/SL-TP** → analyse blijft zelfgerapporteerd %; een serieuze trader groeit eruit. (Wij delen dat plafond deels, maar Richting-veld bestaat al en import-roadmap dicht dit.)
- **Backtesting is mager**: zelfde log-concept als wij, maar zonder onze fase-kenmerken-breakdowns; free = 1 project/5 backtests ("teaser").
- **Free tier is gierig**: 20 trades *totaal* ooit, kalender/analytics op slot, en zelfs Free vereist expliciete plan-keuze. Try-before-value is zwak — daar kan onze freemium ("volwaardig journal gratis") onder duiken.
- **Slordigheden**: taal-mix, payment-test-mode-banner, hernoemde-slots-op-legacy-kolommen. Snelheid boven zorgvuldigheid.
- Geen PWA/mobile-verhaal zichtbaar (wij: PWA + quick-log live achter beta).

## 5. Wat doen wij beter

- **Multi-journal-architectuur** (methodologies + per-journal velden/trades/reviews/accounts + presets) — hun hele Data Set-up is één globale configuratie.
- **Statistiek-integriteit**: missed trades zijn bij ons contractueel uit alle echte stats (`isMissed()`/`takenTrades()` overal); BE-pauze-streakregel; drawdown-markers; `round2(-0)`-zorgvuldigheid. Bij hen is niet verifieerbaar of missed trades de cijfers vervuilen.
- **Screenshots-upload** (Supabase Storage + paste) vs. hun URL-velden.
- **Open/lopende trades** (entry zonder resultaat, later sluiten) — hun formulier vereist een Result.
- **Review-diepgang**: configureerbare review-secties (N5), review-sharing, PDF-export; hun review is een vast vragenlijstje (wel met streaks).
- **Kalender gratis** met dag-detail, pair-chips, weektotalen — bij hen Pro-only.
- **Import-fundament**: TV-export + generic CSV-parser gebouwd (geparkeerd); zij hebben alleen Excel-import op Pro. Gelijkspel op "shipped", wij dieper op parsing.
- **Werkwijze**: lint/test/build-gates, migratie-register, model-per-fase — hun bundle toont meer haast-sporen.

## 6. Waar blinken ze in uit (eerlijk erkennen)

**De motivatie- en business-laag.** Alles wat een journal van "database" naar "coach" tilt — AI, e-mails, streaks, discipline score, share-cards — plus alles wat een project van "side-project" naar "bedrijf" tilt — pricing, trial, blog, SEO-tools, juridische basis. Op de kern-journal-engine zijn we minstens gelijkwaardig; op productisering staan zij 6-12 maanden voor.

## 7. Wat missen wij (bevestigd door deze audit)

| Gat | Zwaarte | Bestaat bij ons al als plan? |
|---|---|---|
| AI-laag (reviews, coach, plan-compliance) | Groot, maar post-launch | Nee — nieuw roadmap-item |
| E-mail-cadans (weekly digest) | Groot, goedkoop te bouwen | Nee — nieuw |
| $-weergave afgeleid van account-startkapitaal | ~~Gat~~ — **hebben wij al** (Fase J: %/R/$-weergave-toggle, sinds beta-flip open) | Enig restverschil: hun multi-account-per-trade-fanout; ons geld/R-*invoer*-plan blijft cyclus 8 |
| Discipline-laag (emoties, gedrags-tags, score, checklist) | Middel | Deels — past als preset-categorie-pack in onze custom velden i.p.v. hardcoded |
| Trade-plan-builder + plan-koppeling per trade | Middel | Nee |
| Share-cards / growth-loops | Middel, post-launch | Nee |
| Billing + trial + marketing-site | Groot — dé launch-blocker | Ja — Fase G-rest/P |
| Multi-account per trade (prop-firm) | Klein-middel | Accounts bestaan per journal; junction-idee is overneembaar |

## 8. Voor welk product zou je kiezen?

- **Als Archer-stijl forex/prop-trader die vandaag een af product met coaching wil:** Create Impacts. Het is af, gelanceerd, gepolijst, en de AI-plan-compliance-lus is uniek in deze prijsklasse.
- **Als trader met meerdere strategieën/journals, backtest-discipline, open trades en screenshot-workflow:** Beyen. Onze kern (journal-architectuur, stats-integriteit, review-diepgang, kalender) is sterker en flexibeler.
- **Strategisch:** hun bestaan is *goed nieuws* — het valideert de markt, het Benelux-prijspunt (€19/29) én onze Scope-C-pivot. Maar het bevestigt ook dat snelheid naar launch nu zwaarder weegt dan extra features: zij verzilveren een zwakkere engine met een sterkere verpakking.

## 9. Analyse als beste trader

Wat verbetert je trading écht? Niet méér statistieken, maar gedragsverandering op het moment van risico. Hun pre-trade checklist, emotie-registratie en plan-compliance % grijpen precies daar in; de weekly e-mail is externe accountability. Dat is hoog-impact design. Hun plafond: zonder prijzen/richting/MAE-MFE is alles zelfrapportage — je kunt executie niet objectief toetsen, en de discipline score is zo betrouwbaar als je eigen tags. Voor een trader die zichzelf voor de gek houdt (de doelgroep van een journal…) is geïmporteerde broker-data uiteindelijk de enige harde spiegel. Conclusie: kopieer hun *interventie-momenten* (checklist, plan-koppeling, weekritme), maar bouw ze op onze hardere data-fundering.

## 10. Analyse als beste engineer

Competente indie-engineering, duidelijk op snelheid geoptimaliseerd: moderne stack (TanStack Start levert ze SSR en nette code-splitting), maar business-logica in de client, denormalisatie-smells, al opgebouwde legacy-kolom-schuld, taal-lekken en een test-mode-banner in productie. Niets daarvan hindert hun gebruikers vandaag — en dat is de les: hun technische schuld zit op plekken die klanten niet zien, terwijl hun zichtbare laag glimt. Wij doen het omgekeerde (degelijke engine, onaffe verpakking). De juiste reactie is niet "onze engine nog beter maken", maar onze bestaande kwaliteit sneller zichtbaar maken. Eén waarschuwing overnemen: hun hernoemde-screenshot-slots-op-legacy-kolommen laten zien hoe snel "tijdelijke" kolommen permanent worden — onze cyclus-10-opruiming (label_key-migratie) verdient prioriteit vóór er meer op de legacy-velden gestapeld wordt.

## 11. Kapitaliseren — concrete aanbevelingen (op volgorde)

1. **Launch-tempo vasthouden** (Fase G-rest → beta → billing): zij bewijzen dat €19/29 in de Benelux werkt; elke maand vertraging is marktaandeel.
2. **%→$-weergave**: ~~overnemen~~ — **bestaat al** (Fase J, %/R/$-toggle). Actie beperkt zich tot: dit op de landing/feature-lijst zichtbaar maken, want het neutraliseert hun zichtbaarste voordeel nu al.
3. **Weekly digest e-mail** (goedkoop, hoge retentie): Supabase cron + mailprovider; stats hebben we al.
4. **Discipline-pack als preset** (past in onze architectuur): emotie vóór/na, gedrags-tags en een eenvoudige checklist als optioneel veld-pack — configureerbaar, niet hardcoded zoals bij hen.
5. **Trade-plan-koppeling** overwegen bij het onboarding/preset-werk (plan = regels; regels = onze condities/criteria — wij hebben de datastructuur al half).
6. **AI-roadmap ná launch**: onze gestructureerde per-journal-data is een *beter* AI-substraat dan hun vrije tekst; plan-PDF-extractie is het sterkste idee om te lenen.
7. **Niet kopiëren**: verplichte plan-keuze vóór gebruik, 20-trades-totaal-limiet, URL-screenshots.
8. **Free tier scherp positioneren**: "volwaardig journal gratis" tegenover hun 20-trades-teaser — dat verschil expliciet op onze landing zetten.

---

*Bronnen: live free account op createimpacts.eu (dashboard, trades, add-trade-dialog, accounts, calendar-gate, backtesting, review, SMB-gate, analytics-gate, trade plan-gate, data set-up, share, coach-gate, settings, 404), pricing-pagina met volledige feature-matrix, netwerkverkeer van het eigen account (Supabase REST/auth-calls, asset-manifest). Geen actieve security-tests uitgevoerd.*
