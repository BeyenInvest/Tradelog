# Concurrentie-analyse — trade journals & backtesting (augustus 2026)

> **Doel:** de 10+ beste journal/backtesting-platformen naast Beyen leggen: wat doen zij beter, wat missen wij, wat doen wij beter en hoe kapitaliseren we daarop.
> **Methode:** webonderzoek (vendorsites + onafhankelijke vergelijkers: daytradingz, tradeciety, stockbrokers.com e.a.), afgezet tegen de huidige Beyen-feature-set (main, 2026-08-13).

---

## 1. Het speelveld in één tabel

| # | Platform | Prijs | Kern-sterkte | Kern-zwakte |
|---|---|---|---|---|
| 1 | **TradeZella** | $35–99/mnd | Alles-in-één: journal + AI (Zella) + bar-replay-backtesting + educatie; 500+ broker-syncs; backtests journalen naast live trades | Duur, geen free tier |
| 2 | **TraderSync** | $30–80/mnd | 700+ broker-integraties, beste mobile apps, Cypher AI-coaching | AI pas op dure tiers en na 100+ trades; duurste topplan |
| 3 | **Edgewonk** | $197/jr (~$16/mnd) | Psychology-first: Tiltmeter (emotie↔performance), mistake/rule-break-tracking met P&L-kost van indiscipline, Edge Finder | Alleen jaarabo, geen mobile app, auto-sync beperkt (MT4/5), geen replay |
| 4 | **Tradervue** | Free / $30–50/mnd | 14 jaar track record; enige met betekenisvolle free tier (100 stock-trades/mnd); commissie/liquiditeits-rapporten; mentor-sharing | Verouderd: geen AI, geen backtesting, geen mobile, 2.6/5 Trustpilot |
| 5 | **TradesViz** | Free / $17–30/mnd | 600+ statistieken, auto-gegenereerde charts per trade, AI-Q&A over je data, gulste free tier (3.000 executions/mnd), simulators | Gedateerde, overweldigende UI; steile leercurve |
| 6 | **Chartlog** | $15–40/mnd | Per-strategy performance (win rate/profit factor/risk-adjusted per setup), TradingView-charts, goedkoopste échte autosync | Generieke UI, smallere feature-set |
| 7 | **Trademetria** | Free / $20–40/mnd | Tot 50 accounts, 140+ broker-syncs, clean design, breed (stocks/options/futures/forex/crypto/CFD) | Ondiepere analytics, geen replay |
| 8 | **Journalytix** (Jigsaw) | $47/mnd | Real-time: live P&L-dashboard, risk-alerts en feedback *tijdens* de sessie | Futures-only-focus, weinig post-sessie-diepgang |
| 9 | **Myfxbook** | Gratis | Auto-sync MT4/MT5, geverifieerde track records, grote community, AutoTrade | Forex-only, gedateerd, journal-functie ondiep (geen psychologie/notities-diepgang) |
| 10 | **Stonk Journal** | Gratis (donaties) | Volledig gratis, clean, anoniem te gebruiken, setups/confidence-levels | Alleen handmatige invoer, basale analytics, continuïteitsrisico |
| 11 | **FX Replay** (backtesting) | Free / $18–35/mnd | Browser-based bar-replay op TradingView-charts (forex/futures/stocks/crypto, data tot 2003, 5s-candles), ingebouwd journal | Puur oefenen/backtesten; journal is bijzaak |
| 12 | **UltraTrader** | freemium | Mobile-first journal, automatische imports, visuele analytics | Minder diepgang, jonger platform |

**Rode draad in de markt (2026):** ① auto-sync met brokers is table stakes geworden, ② AI-features zijn het marketingwapen van elke premium-speler, ③ bar-replay-backtesting is de acquisitie-hook (TradeZella, FX Replay), ④ een gulle free tier is de bewezen funnel (Tradervue, TradesViz), ⑤ mobile apps onderscheiden de top van de middenmoot.

---

## 2. Wat zij beter doen dan wij (gaten, op impact-volgorde)

### 2.1 Automatische trade-import / broker-sync — *het grootste gat*
Elke serieuze concurrent importeert automatisch (TradeZella 500+, TraderSync 700+, Edgewonk "1.000 trades in 12 seconden", Myfxbook realtime MT4/5-sync). Bij ons is alles handmatig; de MetaTrader-CSV-import is gebouwd maar geparkeerd tot de eerste echte CSV. Handmatige invoer is voor scalpers/daytraders een dealbreaker — dit bepaalt wie überhaupt klant kán worden.

### 2.2 Chart-gebaseerde backtesting (bar replay)
Ons "backtesting" is een *log* van handmatig uitgevoerde backtests; TradeZella en FX Replay bieden candle-voor-candle replay met orderpanel op echte historische data — je *doet* de backtest in de tool. TradeZella laat backtests bovendien auto-journalen naast live trades (dat concept hebben wij wél). Een replay-engine zelf bouwen is een enorm project (data-licenties, chart-engine) — zie §4 voor het alternatief.

### 2.3 Automatische trade-charts & screenshots
TradesViz genereert automatisch een chart per trade met entry/exit geplot; TradeZella plot executies op charts met tick-data. Wij hebben vier screenshot-*URL*-velden. Screenshot-upload (Supabase Storage + paste) staat al geparkeerd als "grootste dagelijkse QoL-win" — de lat ligt bij concurrenten nog hoger (auto-charts), maar upload+paste is de realistische eerste stap.

### 2.4 Geld/R als resultaat-eenheid + kostenanalyse
Wij rekenen alles in %. Vrijwel iedereen toont geld-P&L als primaire eenheid; Tradervue analyseert zelfs commissies/fees/liquiditeit. Geld/R is bij ons al ontworpen (ontwerpdoc §6, cyclus 8) en is de "grootste doelgroep-verbreder" — dit gat is gekend en gepland.

### 2.5 AI-laag
Zella AI (auto-tagging, session reviews, "edge verdict"), Cypher (TraderSync), Edge Finder (Edgewonk), natural-language-Q&A (TradesViz). Wij hebben niets. Nuance: AI op óngestructureerde data levert generieke inzichten; onze custom velden + condities maken de data juist rijk gestructureerd — een latere AI-laag kan daardoor *beter* zijn dan die van hen (zie §4).

### 2.6 Mobile app
TraderSync en UltraTrader zetten hier de standaard; Edgewonk/Tradervue missen het ook. Wij zijn responsive web zonder PWA-strategie. Voor "trade loggen vanaf je telefoon direct na de sessie" is minimaal een PWA (installeerbaar, offline-tolerant) nodig.

### 2.7 Diepere execution-metrics
MAE/MFE (hoe ver liep een trade tegen/mee voor exit), exit-analyse ("wat als ik mijn plan had gevolgd"), hold-time-optimalisatie, Sharpe/Calmar. Wij hebben expectancy, profit factor, drawdown, streaks — de basis is er, de execution-diepte niet. MAE/MFE staat bewust out-of-scope (spec §7-8) maar is bij Edgewonk/TradeZella een kernrapport.

### 2.8 Sharing & community
Myfxbook's geverifieerde track records, Tradervue's mentor-sharing, TradeZella's gedeelde backtest-sessies. Wij zijn single-player. Voor coaching-relaties (onze review-PDF hint er al naar) is een read-only share-link van een journal/review een kleine bouwsteen met groot effect.

### 2.9 Acquisitie-funnel
Tradervue's les: een betekenisvolle free tier is dé instap. Onze freemium-afbakening (compleet werkend journal gratis, betalen voor hoeveelheid+customisatie) is al beslist en spoort hiermee — maar er is nog geen landing page, geen trial-verhaal, geen educatie-content (Zella University laat zien hoe ver dat kan gaan).

---

## 3. Wat wij beter doen (en zij niet of half)

### 3.1 Configureerbare methodiek per journal — *onze kern-differentiator*
Niemand in de lijst heeft wat wij hebben: een **veld-editor met typen, opties én conditionele zichtbaarheid** ("toon veld X als Y ∈ {…}"), per journal, met presets per asset×stijl en fork-on-edit. Concurrenten doen tags (allemaal), setups/strategies (Chartlog, TradeZella playbooks) of custom kolommen (TradesViz) — allemaal *plat*. Een methodiek is bij ons een invulbaar formulier dat je analyse stuurt; bij hen een label achteraf. Dit is exact de differentiatie die het ontwerpdoc voorschrijft (condities + UX + presets, niet "je kan velden toevoegen").

### 3.2 Statistische hygiëne
"Missed trade" als hypothetisch concept dat *nergens* echte cijfers vervuilt (afgedwongen via één shared helper-laag), BE die een streak pauzeert i.p.v. breekt, win-rate excl. BE als toggle, -0-normalisatie, chronologie met vaste tie-break. Concurrenten tonen meer metrics; de *correctheid* van randgevallen is bij ons een expliciet ontwerpprincipe. Edgewonk is de enige die missed trades serieus neemt.

### 3.3 Gestructureerde weekly/periodic reviews + PDF-export
Edgewonk heeft weekly reviews; niemand heeft onze combinatie van vaste review-structuur (incl. mentaal-veld) + PDF-export voor coach/mentor. Dit sluit aan op de coaching-workflow zonder community te hoeven bouwen.

### 3.4 Backtest-projecten in dezelfde motor als het journal
Backtests en live trades delen bij ons dezelfde velden, dezelfde stats-motor en dezelfde methodiek-configuratie. Alleen TradeZella doet iets vergelijkbaars; bij ons is het bovendien methodiek-bewust (je backtest je *eigen* velden/condities).

### 3.5 Journal-niveau-isolatie i.p.v. alleen account-niveau
Concurrenten doen multi-*account* (Trademetria: 50); wij doen multi-*methodiek*: trades, reviews, accounts én instrumentenlijst per journal gescheiden. Wie twee stijlen tradet (scalpen + swing) krijgt bij ons twee schone boeken; bij hen één vergaarbak met tags.

### 3.6 Taal & regio
Volledig NL/EN. Geen enkele speler in de lijst bedient de Benelux in het Nederlands. Gecombineerd met EU-hosting/GDPR-verhaal (Supabase, geen data-verkoop) is dit een verdedigbare niche — de NL/BE prop- en retail-trader-community is groot en onbediend in eigen taal.

### 3.7 Prijsruimte
Het veld zit op $17–99/maand; Edgewonk bewijst dat ~$16/mnd houdbaar is. Wij kunnen ons freemium+scherp-geprijsd positioneren zonder race-to-the-bottom, omdat de gratis laag al compleet is en de premie op customisatie zit.

### 3.8 Vers, rustig product
TradesViz' les: 600 statistieken zonder hiërarchie = overweldiging; Tradervue's les: stilstand = 2.6/5 Trustpilot. Onze bewuste curatie (KPI-rij via één entry point, config-driven breakdowns, empty-state-onboarding) is een feature, geen gebrek — mits we hem zo blijven bewaken.

---

## 4. Hoe kapitaliseren — concrete richting

**A. De methodiek-differentiator uitbouwen (verdedigbaar, uniek):**
1. **Preset-bibliotheek als groeimotor** — meer recepten (ICT/SMC, breakout, mean-reversion, opties-wheel, …); later community-presets ("deel je methodiek als template") als lichte netwerk-play zonder volledige community te bouwen.
2. **Conditie-bouwer zichtbaar maken in marketing** — "jouw methodiek als invulbaar formulier" is de one-liner die niemand anders kan claimen.
3. **Methodiek-analyse verdiepen** — breakdowns per custom veld bestaan al; volgende stap: "welke veld-waarde-combinaties verdienen/kosten geld" (regel-adherentie à la Edgewonk/RizeTrade: wat kost het afwijken van je eigen condities?).

**B. Gekende gaten dichten in deze volgorde (impact × haalbaarheid):**
1. **CSV-import activeren en verbreden** (MetaTrader ligt klaar; daarna TradingView/FX Replay-export — zie D) — dicht het grootste gat zonder broker-API's te hoeven bouwen. Auto-sync (MT4/5 eerst, à la Edgewonk) pas daarna.
2. **Geld/R-weergave** (cyclus 8, al ontworpen) — grootste doelgroep-verbreder.
3. **Screenshot-upload + paste** (al geparkeerd als QoL-#1) — dicht 80% van het auto-chart-gat voor 5% van de moeite.
4. **PWA/mobile-instap** — installeerbaar + een snel "quick log"-formulier; geen native app bouwen.
5. **MAE/MFE-velden** — optioneel invulbaar (of uit CSV), twee kolommen + twee rapporten; heropenen zodra import loopt.
6. **Read-only share-link** voor journal/review — coaching-niche bedienen, voorbij de PDF.

**C. Niet doen (bewust — owner-beslissing 2026-08-13):**
- **Geen eigen bar-replay-engine, definitief.** Naast het kosten-argument (data-licenties + chart-engine is een eigen bedrijf) is er een ervarings-argument: de owner heeft TradeZella's replay zelf gebruikt en vond hem slecht bruikbaar — zelfs de marktleider krijgt dit niet goed. **TradingView is king** als chart/replay-omgeving; daartegen bouwen is verloren moeite. In plaats daarvan: **frictieloze import vanuit TradingView** (en evt. FX Replay) zodat Beyen de *analyse-laag* wordt bovenop de chart-laag waar traders toch al zitten. Zelfde logica als geen eigen community bouwen naast Myfxbook.
- **Geen AI-checkbox-feature nu** — wachten tot de gestructureerde data (custom velden) volume heeft; dan is "Edge Finder over jouw eigen methodiek-velden" een sterkere AI-story dan generieke chat-over-je-trades.

**D. Positionering:**
- **Niche eerst:** NL/BE (+ EU prop-traders) in eigen taal, methodiek-first, eerlijke statistiek. Niet frontaal tegen TradeZella's alles-in-één.
- **Free tier als funnel** (beslist model past bij de bewezen Tradervue/TradesViz-les); landing page (fase G) moet de methodiek-differentiator tonen, niet "nóg een journal".
- **Eerlijkheid als merk:** "missed trades vervuilen je cijfers nooit; BE liegt niet in je streak" — statistische integriteit als expliciet verkoopargument tegenover metric-inflatie bij concurrenten.

---

## 5. Bronnen

- https://www.tradezella.com/blog/best-trading-journal-software · https://www.tradezella.com/features · https://www.tradezella.com/backtesting
- https://tradeciety.com/best-online-trading-journals
- https://daytradingz.com/best-trading-journal/
- https://www.tradesviz.com/ · https://www.edgewonk.com/ · https://fxreplay.com/
- https://www.stockbrokers.com/guides/best-trading-journals · https://www.tradervue.com/blog/best-trading-journal
- Myfxbook-reviews: https://eafxstore.com/blog/myfxbook-review/ · https://traderssecondbrain.com/guides/myfxbook-alternative
