# Landing page B5 v2 — strategie & positionering (2026-09)

Werkdocument voor de herbouw van de landing page volgens de "Strategic Design & Positioning
Master Prompt" (PDF, 2026-09-03). Backup van v1: branch `backup/fase-b5-landing-v1` (9ce541f).

## 1. Kritische analyse van v1 (brutaal eerlijk, per prompt §18)

### Wat goed is en behouden blijft
- **De claims zijn waar.** Niets verzonnen: methodiek-velden, gemiste-trades-uitsluiting,
  BE-streakregel, backtest-isolatie, TradingView-positionering, gratis tier — alles bestaat.
- **Drie echte differentiators** zitten er al in: (1) journal bouwt zich rond jóuw methodiek,
  (2) cijfers die niets verbloemen (missed/BE-regels), (3) bewust géén chart — analyse-laag
  bovenop TradingView.
- Serif-display + mono-data + goud is geen paars-AI-gradient-cliché.
- Geen neptestimonials, geen "AI-powered", geen countdown-banners.

### Wat fundamenteel zwak is (en waarom v2 nodig is)
1. **De structuur is het standaard SaaS-skelet** dat de prompt expliciet verbiedt:
   hero + browser-mockup → statband → 6 genummerde feature-splits → icon-cardgrid →
   pricing-cards → CTA-band. Verwissel het logo en niemand merkt het (quality bar §19 faalt).
2. **De statband is nep-statistiek** ("€0 / ∞ / 2-in-1 / 0"). Een statrij zonder echte cijfers
   is precies het holle SaaS-patroon dat vertrouwen kost bij een sceptische trader.
3. **Sectie 06 (icon-cardgrid met 6 features)** is het meest generieke SaaS-element dat bestaat.
4. **Goud overal** = decoratie-tic: elk kopje een gouden italic <em>, gouden hoekjes, gouden
   kickers, gouden pulse. Premium merken doseren hun accent; v1 strooit ermee.
5. **De pagina begint bij het product, niet bij de bezoeker.** De mentale reis
   (Attention → Recognition → Belief → Desire → Trust → Action) mist stap 2 volledig:
   nergens wordt de pijn benoemd (zelfbedrog, emotionele fouten, niet weten waaróm je
   wint/verliest). De hero verkoopt een feature (configureerbaarheid), niet een identiteit.
6. **Frame-corners/rangefinder-motief + gridlijnen + glow** neigt naar "trendy dashboard-SaaS",
   niet naar institutionele rust.

## 2. Strategie (Fase 2 uit de prompt)

- **Target user**: serieuze (aspirant-)systematische trader — handelt een methodiek
  (ICT/SMC, breakout, mean-reversion, eigen systeem), journalt nu in Excel/Notion/niets,
  is sceptisch tegenover trading-marketing en guru-beloftes.
- **Core problem**: hij weet niet *waaróm* hij wint of verliest. Zijn geheugen liegt,
  zijn spreadsheet meet de verkeerde dingen, en bestaande journals dwingen hem in andermans velden.
- **Core promise**: bewijs in plaats van gevoel. Beyen meet je eigen methodiek en vertelt je
  de waarheid — ook als die tegenvalt.
- **Positionering**: het eerlijke instrument voor procesgedreven traders. Geen coach, geen
  signalen, geen hype: een meetinstrument.
- **Differentiatie** (alles bestaand):
  1. Journal gebouwd rond jouw methodiek (velden = jouw condities → elke conditie een breakdown).
  2. Cijfers die niet liegen: gemiste trades tellen nooit mee, BE pauzeert een streak,
     backtests raken live nooit.
  3. Bewust geen chart/replay: TradingView is king; Beyen is de analyse-laag erbovenop.
  4. Gratis tier = volwaardig journal.
- **Brand personality**: kalm, precies, direct, soms confronterend, nooit hype. Stoïcijns als
  fundament (proces boven uitkomst, waarheid boven comfort) — nooit als decoratie.
- **Emotional outcome**: controle en rust — "ik weet wat mijn edge is en wat niet."
- **Identity sell** (Feature→Benefit→Outcome→Identity): je wordt een trader die op bewijs
  handelt in plaats van op gevoel.
- **Messaging-hiërarchie**: 1) waarheid/bewijs, 2) jouw methodiek als meetlat,
  3) discipline zichtbaar gemaakt, 4) de juiste laag (TV), 5) gratis en compleet.

## 3. Merk-richting (Fase 3)

- **Typografie**: Instrument Serif (display, groot, rustig — geen italic-gimmick meer als
  standaard), Inter (body), IBM Plex Mono (data/cijfers, labels). Typografie draagt de pagina;
  panelen en iconen ondersteunen alleen waar ze iets bewijzen.
- **Kleur**: bestaande app-palette (charcoal `#121317`-familie donker, off-white licht,
  goud `--color-gold` als énige accent) — maar goud gereserveerd voor: primaire CTA,
  één accent per scherm, datalijn. Win/loss/BE-kleuren alleen in echte data.
- **Beeld**: uitsluitend product-waarheid (echte UI-patronen nagebouwd als levende panelen),
  géén stockfoto's, geen abstracte 3D, geen device-mockups.
- **Motion**: alleen betekenis — een equity-lijn die zich tekent, cijfers die verschijnen,
  subtiele reveals. Geen decoratieve corners-animatie.
- **Tone of voice**: korte zinnen. Confronterend waar het waar is. Nooit uitroeptekens,
  nooit "unlock/supercharge/next level".

## 4. Informatie-architectuur (Fase 4) — de mentale reis

1. **HERO — Attention**: één confronterende waarheid + één zin wat Beyen is + één CTA.
   Typografisch, rustig. Het product als stil bewijs eronder of ernaast.
2. **RECOGNITION — de pijn**: het zelfbedrog van traders benoemd (geheugen liegt, spreadsheet
   meet verkeerd, journals dwingen in andermans velden). Kort, editorial, geen panelen.
3. **BELIEF 1 — jouw methodiek als meetlat**: veld-editor + breakdown per eigen conditie.
4. **BELIEF 2 — cijfers die niet liegen**: missed/BE/chronologie-regels als "grondwet",
   getoond met echte productlogica.
5. **BELIEF 3 — discipline gemeten**: regel gevolgd vs. gebroken (het meest confronterende
   en meest stoïcijnse bewijs dat het product levert).
6. **BELIEF 4 — backtest vóór risico**: isolatie, zelfde rekenkern.
7. **TRUST — de juiste laag**: geen chart, geen replay, geen AI-beloftes; TradingView blijft.
   Plus: gebouwd door een trader, gratis tier is compleet, geen creditcard.
8. **ACTION — prijs + slot-CTA**: sober, twee tiers, geen discount-theater.

Weggelaten t.o.v. v1: nep-statband, 6-icon-cardgrid (features verhuizen naar één sobere
lijst binnen Trust/pricing), decoratieve frame-corners.

## 5. Researchbevindingen A — concurrentie (2026-09-03)

Onderzocht: TradeZella, Edgewonk, Tradervue, TraderSync, TradesViz, Chartlog, Stonk Journal,
Trademetria, Journalytix/Jigsaw, FX Blue/Myfxbook + Notion/Excel-templates als indirecte
alternatieven. (TraderSync en Myfxbook via reviews; blokkeerden fetches.)

### DO NOT LOOK LIKE THIS (categorie-uniform, bewust vermijden)
**Taal:** "Trade Smarter" (letterlijk Chartlog-hero); "edge" als mystiek object ("uncover/find
your hidden edge" — bij 6 van de 10); "turn your data into profits"; "stop guessing, start
winning"; ongestaafde "#1"-claims; de 2025/26-golf "AI coach / AI trading partner" (TradeZella,
TraderSync, TradesViz, Stonk Journal, Trademetria — állemaal); "actionable insights";
"all-in-one"; "improve your trading performance".
**Visueel/structureel:** donkere hero met neon-accent + zwevende dashboard-screenshots;
broker-logowall; mega-getallen-strook (X traders / Y miljard trades); Trustpilot/Capterra-badge
in de hero; countdown-timers en sale-banners (Edgewonk, TradesViz); live signup-tickers
(TradeZella); guru-testimonials met avatars; feature-grid van 6–9 icon-kaartjes;
structuur hero → logos → features → testimonials → CTA.

### OWNABLE TERRITORY
- **Kalm/editorial/stoïcijns bestaat niet in deze categorie.** Iedereen belooft wínst; niemand
  belooft helderheid, eerlijkheid of vakmanschap. Serieus + mooi + menselijk is volledig vrij.
- **Niemand is écht premium.** Duurste speler (TraderSync) verkoopt met dezelfde badges;
  Edgewonk saboteert degelijkheid met countdown-timers. Premium-signalen die niemand gebruikt:
  rust, witruimte, typografische hiërarchie, geen kortingen, één weloverwogen CTA, understatement.
- **Taal:** iedereen schrijft Amerikaans conversie-Engels. Een Europese, nuchtere stem
  (register van een goed jaarverslag/designstudio) klinkt als niets anders in het veld.
- **Conceptueel onbezet:** het próces claimen — discipline, review-ritueel, scheiding
  uitvoeringskwaliteit vs. uitkomst (exact Beyen's evaluatie-model "Good trade ≠ Win").
  "Wij maken je niet rijk, wij maken je eerlijk tegenover jezelf" is vrij.
- **Anti-AI-window:** nu vijf spelers "AI coach" roepen is géén AI-hero op zich onderscheidend.
- **De echte concurrent is de spreadsheet** — vrijwel niemand positioneert daar expliciet tegen.
  (Journalytix' "memory with a P&L number attached" is de enige die het mechanisme raakt.)

### Trust-kansen voor een nieuwkomer zonder "100K users"
Eerlijke productweergave in rust (geen gefotoshopte floating cards), een geloofwaardig
"waarom"/de maker (gebouwd door een trader), terughoudendheid zélf als trust-signaal
(geen korting, geen #1-claim, wél precisie), een zichtbare filosofie als bewijs van denkwerk.

## 6. Researchbevindingen B — design-benchmarks (2026-09-03)

Onderzocht: Linear, Stripe, Vercel, Addepar, Koyfin, Stratechery, FT/Financier, Bloomberg
(teardowns), Teenage Engineering, Aesop. Kernprincipes:

- **Luminantie-hiërarchie i.p.v. kleur** (Linear): near-black basis, diepte via subtiele
  opacity-stappen en hairline-borders; één accent, uitsluitend op CTA's/actieve states.
- **Premium ≠ bold**: lage gewichten, groot en licht gezet leest als zelfvertrouwen.
- **Secties gescheiden door lucht, niet door lijnen**; 80px+ verticale ademruimte.
- **Autoriteit = feiten, geen adjectieven**; understatement als toon; weinig CTA's,
  één consistente CTA-tekst.
- **Serif als autoriteitsinstrument** (FT/Financier): één klassieke display-serif naast een
  neutrale sans is hét editorial-financial-signaal. Donker = vakmanschapssignaal (Bloomberg).
- **Product als object tonen**: echte UI, vlak en precies uitgelijnd — geen schuine
  3D-browser-mockups. Toon échte UI of toon niets.
- **Motion**: alleen het product beweegt (chart tekent zich, getal telt op); entrance-fades
  één keer, kort; nooit bounce/parallax/loops.
- **Anti-AI-slop-lijst** (o.a.): indigo-gradients, glassmorphism+glow, 3 identieke
  icon-cards, gradient-tekst op cijfers, rounded-2xl+dropshadow overal, typewriter-effect,
  scrollende logo-marquee, puur zwart op puur wit.

## 7. Gekozen richting: "serif op grafiet" (Richting C)

- Donkere grafiet-basis (bestaande app-tokens), luminantie-hiërarchie, hairline-borders,
  vrijwel geen schaduwen; licht thema blijft ondersteund.
- **Instrument Serif blijft het display-font** — het is het merk-font van de hele app
  (`font-display` door alle pagina's); landing en app blijven één merk. Inter body,
  IBM Plex Mono voor alles wat een getal of label is (tabular figures).
- Goud strikt gerantsoeneerd: primaire CTA, de equity-lijn, sectienummers. Koppen in ink.
  **Bewust behouden t.o.v. het oorspronkelijke voornemen** (afweging 2026-09-04, na audit
  §11/M5): één gouden `<em>`-accentwoord per sectiekop (i.p.v. per kop een gouden kop),
  de frame-corners uitsluitend rond de hero-stage, en één subtiele glow+grid-ambient achter
  de hero die op 55% uitfadet. Dit is de doseer-versie van het v1-euvel ("goud overal, elk
  kopje een gouden italic, gouden hoekjes, gouden pulse") — de pulse is weg, de rest is tot
  één plek/één woord teruggebracht en geeft de pagina eigenheid zonder in "trendy dashboard-
  SaaS" te vervallen. Wie later een puurdere Linear/FT-look wil, behandelt dat als een
  bewuste design-iteratie, niet als bugfix.
- Elk paneel bewijst iets (veld-editor, trades-lijst, adherence-tabel, backtest); de
  nep-statband en het 6-icon-cardgrid vervallen. Utilities (reviews, PDF, kalender,
  lot-size, NL/EN, accounts) worden één sobere mono-regel bij pricing.
- Eén "papier"-tussenblok (geïnverteerd t.o.v. het thema) voor het trust/filosofie-blok:
  bewust geen chart, geen AI-coach, geen signalen; gebouwd door een trader.
- Structuur = mentale reis: hero (confrontatie + product-bewijs) → herkenning (editorial,
  zelfbedrog) → methodiek als meetlat → cijfers die niets verbloemen → discipline is
  meetbaar (uitvoering ≠ uitkomst) → backtest-isolatie → papier-tussenblok (trust) →
  prijs → slot-CTA "Begin met de waarheid."
