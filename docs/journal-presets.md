# Beyen — Journal-presets (asset class × traderstijl)

> Hoort bij [ontwerp-configureerbaar-journal.md](ontwerp-configureerbaar-journal.md). Dit is de **concrete seed-bron** voor de presets (cyclus 6).
> Onderbouwd met research (bronnen onderaan) naar wat elk type journal in de praktijk bijhoudt.
>
> **Freemium-rol:** de presets *zijn* de gratis waarde. Een gratis user kiest bij onboarding één recept (§6), krijgt een compleet werkend journal met **vaste velden**, en betaalt zodra hij die velden zelf wil aanpassen of meer journals wil (zie ontwerp §8).

---

## 1. Model — twee assen

Een journal wordt samengesteld uit twee onafhankelijke assen:

- **Asset class** → instrument-universum + sizing-tools + asset-specifieke velden (contractmaand, float, funding…).
- **Traderstijl** → stijl- & psychologie-velden (setup, kwaliteit, emotie, beheer…), asset-agnostisch.

De user ziet geen twee losse keuzes maar **kant-en-klare recepten** (§6) die beide assen al combineren. Onder de motorkap is een recept = (asset-preset ∪ stijl-preset), samengevoegd tot één veldenset op een `methodologies`-rij (ontwerp §3, optie B).

---

## 2. Universele kern (vast, voor élk recept — geen custom veld)

Deze staan als echte kolommen op `trades` en zijn nooit onderdeel van een preset:

`datum_open` · `datum_sluiting` (+ `duur_dagen` afgeleid → gratis holding-period-analyse) · `instrument` · **`direction` (Long/Short — nieuw)** · `outcome` (Win/Loss/BE) · `resultaat_pct` (+ `risk_pct` → R afgeleid) · `notes` · screenshots · `trade_evaluation` (Good/Emotional error/Technical error/Missed — Beyens bestaande uitvoerings-kwaliteitsas).

> Omdat kern-resultaat in **%/R** rekent, verschilt sizing (lots/ticks/aandelen/coins) enkel in de instrument-lijst + welke tool verschijnt — de stats-motor blijft gedeeld.

---

## 3. Gedeelde veld-bouwstenen (herbruikt over stijlen)

| key | label | type | opties |
|---|---|---|---|
| `setup` | Setup | enum | *user vult eigen setups* (leeg starten) |
| `timeframe` | Timeframe | enum | per stijl (zie §5) |
| `market_condition` | Marktconditie | enum | Trending · Ranging · Volatiel/nieuws |
| `quality` | Setup-kwaliteit | enum | A+ · B · C · Off-plan |
| `mistake` | Fout | enum | Geen · FOMO · Revenge · Oversized · Chased · Te vroeg · Te laat |
| `emotion` | Emotie | enum | Kalm/gedisciplineerd · FOMO · Angst · Hebzucht · Revenge |

> `quality`/`mistake` overlappen deels met de kern-`trade_evaluation`; een stijl-preset neemt ze enkel op als hij fijnere tagging wil dan de kern-as.

---

## 4. Asset-class-presets

Elk levert: instrument-bron, sizing-tool(s), en asset-specifieke velden.

### 4.1 Forex
- **Instrument:** FX-pairs (bestaande `PAIRS`-lijst). **Sizing:** lot-calculator, pip-waarde, currency-split.
- **Velden:** `session` enum [Asia · London · New York · Overlap] · `news` boolean "High-impact nieuws?"

### 4.2 Futures
- **Instrument:** futures-symbolen (ES, NQ, YM, RTY, CL, GC, MES, MNQ…). **Sizing:** tick-waarde per contract (lookup-tabel in `instrument_config`, bv. ES = $12,50/tick, NQ = $5/tick), aantal contracten.
- **Velden:** `contracts` number "Aantal contracten" · `contract_type` enum [Standard · Micro] · `contract_month` text "Contractmaand (bv. ESH6)" · `hours` enum [RTH · ETH] · `session` enum [Pre-market · Regular · Overnight]

### 4.3 Stocks
- **Instrument:** tickers (vrij / eigen lijst). **Sizing:** aandelen.
- **Velden:** `sector` enum [Tech · Healthcare · Financials · Energy · Consumer · Industrials · Materials · Utilities · Real Estate · Communications] · `market_cap` enum [Large · Mid · Small · Micro] · `float` enum [Laag · Middel · Hoog] · `catalyst` enum [Earnings · FDA · Up/downgrade · Sectornieuws · Gap · Breakout · M&A · Geen] · `session` enum [Pre-market · Regular · After-hours]

### 4.4 Crypto
- **Instrument:** coins (BTC, ETH…). **Sizing:** coins / USD-notional, 24/7.
- **Velden:** `market_type` enum [Spot · Perpetual · Futures] · `leverage` number "Hefboom (x)" *(toon als market_type ∈ {Perpetual, Futures})* · `funding_rate` number "Funding rate %" *(toon als market_type = Perpetual)* · `session_utc` enum [Asia · Europe · US]

---

## 5. Traderstijl-presets (asset-agnostisch)

### 5.1 Starter (universeel, minimaal — de neutrale default)
`setup` · `market_condition` · `emotion`. Klaar in <1 min per trade. Voor wie geen uitgesproken stijl kiest.

### 5.2 Scalper (snel, minimaal — <5 min/sessie)
`setup` · `timeframe` [1m · 3m · 5m] · `emotion`. Bewust weinig velden: scalpers loggen in bulk, snelheid > detail.

### 5.3 Day trader
`setup` · `timeframe` [1m · 5m · 15m · 1H] · `market_condition` · `quality` · `mistake` · `emotion`.

### 5.4 Swing trader
`setup` (these) · `timeframe` [1H · 4H · Daily] · `targets` text "Targets (R)" · `market_regime` enum [Bull · Bear · Sideways] · `catalyst` text "Fundamentele katalysator" · `management_notes` text "Beheer-notities (dagelijks)". Holding-period komt gratis uit `duur_dagen`.

### 5.5 Position / Investor *(optioneel, later)*
`thesis` text · `conviction` enum [Laag · Middel · Hoog] · `catalyst` text. Weinig trades, lange horizon.

---

## 6. Recepten-catalogus (het onboarding-menu)

Wat een user bij "nieuw journal" kiest. Elk recept = asset-preset ∪ stijl-preset. Niet-uitputtend; de matrix is vrij combineerbaar, dit is de **aanbevolen startset**:

| Recept | Asset | Stijl | Kernidee |
|---|---|---|---|
| **Weekly Phase Method (Forex)** | Forex | *Weekly Phase Method 4-fasen* (bestaand) | de owner-methodiek, al geseed |
| **Forex — Day trader** | Forex | Day trader | sessies + setups + kwaliteit |
| **Forex — Swing** | Forex | Swing | these + beheer + regime |
| **Futures — Scalper** | Futures | Scalper | ES/NQ, contracten, RTH, snel |
| **Futures — Day trader** | Futures | Day trader | order-flow setups, RTH/ETH |
| **Stocks — Day trader** | Stocks | Day trader | float/catalyst/sector momentum |
| **Stocks — Swing** | Stocks | Swing | katalysator + sector + regime |
| **Crypto — Day trader** | Crypto | Day trader | spot/perp, funding, hefboom |
| **Crypto — Swing** | Crypto | Swing | perp-basis + regime + beheer |
| **Blanco** | Custom | — | enkel de kern, bouw vanaf 0 |

> Vrij uitbreidbaar: elke nieuwe asset (opties, indices) of stijl = een extra preset, geen migratie. Weekly Phase Method is één recept tussen vele.

---

## 7. Gevolg voor de roadmap

Dit is de inhoud van **cyclus 6** (presets-bibliotheek + onboarding) uit ontwerp §7. De asset-velden (§4) en stijl-velden (§5) worden `is_system`-presets (world-readable, fork-on-choose). De futures tick-waarde-lookup en de forex-pairs-lijst leven in `instrument_config` per asset (ontwerp §5).

**Open (ontwerp §9):** definitieve veld-opties per preset finetunen met de user; welke recepten in de v1-catalogus; of Position/Investor mee in v1.

---

## Bronnen

- [TradeZella — How to build a trade journal](https://www.tradezella.com/blog/how-to-build-a-trade-journal) · [Stock trading journal](https://www.tradezella.com/blog/stock-trading-journal) · [Futures trading journal](https://www.tradezella.com/blog/futures-trading-journal)
- [Trader's Second Brain — Swing trading journal (12 velden)](https://traderssecondbrain.com/guides/trading-journal-for-swing-trading) · [Futures journal](https://traderssecondbrain.com/guides/trading-journal-for-futures)
- [Admiral Markets — Scalping vs Day vs Swing](https://admiralmarkets.com/education/articles/forex-strategy/scalping-vs-day-trading-vs-swing-trading)
- [Crosstrade — Futures tick value cheat sheet](https://crosstrade.io/learn/futures-trading/tick-value-cheat-sheet)
- [Coinbase — Funding rates in perpetual futures](https://www.coinbase.com/learn/perpetual-futures/understanding-funding-rates-in-perpetual-futures) · [Altrady — Crypto funding rates](https://www.altrady.com/blog/crypto-trading-strategies/crypto-funding-rates-explained)
- [JournalPlus — Catalyst](https://journalplus.co/learn/glossary/catalyst/) · [FX Replay — Ultimate guide to a profitable trading journal](https://fxreplay.com/learn/the-ultimate-guide-to-building-a-profitable-trading-journal)
