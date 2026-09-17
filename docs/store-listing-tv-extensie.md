# Chrome Web Store-listing — Beyen voor TradingView (beta)

**Status:** klaar om in te vullen in het Web-Store-formulier (blok F4b, `docs/plan-tv-extensie-engines.md` §3).
**Distributie:** eerst **unlisted** naar het beta-cohort; publieke listing pas na ≥2 weken zonder adapter-breuk (plan §5.5).
**Privacy-policy-URL:** https://www.beyen.app/privacy (punt 10 van die pagina gaat specifiek over de extensie).
**Categorie:** Workflow & Planning. **Taal van de listing:** Engels als hoofdtaal, Nederlands als tweede locale.

> Toon: nuchter en feitelijk, geen superlatieven, "beta" overal expliciet. De Web-Store-review leest de
> permission-verantwoording letterlijk naast het manifest — elke zin hieronder moet kloppen met wat de code doet.

---

## 1. Nederlands

### Naam
`Beyen voor TradingView (beta)`

### Korte beschrijving (≤132 tekens — deze telt 103)
```
Log je TradingView-trades in je Beyen-journal: prijzen uit je position-tool en snapshots per timeframe.
```

### Uitgebreide beschrijving
```
Beyen voor TradingView zet een klein paneel op je TradingView-chart waarmee je een trade rechtstreeks in je
eigen Beyen-journal logt.

Wat het doet
• Leest je eigen long- of short-position-tool: richting, entry, stop, target en het R:R dat daaruit volgt.
  Elke waarde blijft aanpasbaar; het paneel toont per veld of hij van de chart komt of van jou.
• Toont de velden van je eigen journal — dezelfde velden, groepen en voorwaarden als in de webapp, inclusief
  je zelfgemaakte velden.
• Logt naar je live journal (als lopende trade) of naar een backtestproject, met je eigen risico% en notities.
• Maakt optioneel snapshots per timeframe (W, D, 4H en een extra slot), of neemt een TradingView-snapshotlink
  over die je zelf plakt. Je oorspronkelijke timeframe wordt na de ronde teruggezet.
• Logt dubbel klikken niet dubbel: dezelfde chart-trade komt één keer in je journal terecht.
• Nederlands en Engels.

Wat je nodig hebt
Een Beyen-account (www.beyen.app) met toegang tot de beta. Koppelen doe je met een eenmalige koppelcode uit
Instellingen; de extensie krijgt daarmee een eigen sessie met exact jouw rechten. Loskoppelen kan altijd vanuit
de extensie.

Wat het niet doet
Geen orders, geen broker-koppeling, geen koersdata, geen eigen chart of replay — TradingView blijft waar je
handelt en tekent; Beyen is de journal- en analyselaag eromheen. Er wordt niets naar derden gestuurd en er zit
geen tracking of advertentie in.

Beta
Deze versie is een beta: er verandert nog van alles, en TradingView-updates kunnen het uitlezen van de chart
tijdelijk breken. Loopt er iets mis, dan zegt het paneel wat je handmatig kunt invullen — je verliest nooit een
trade aan een leesfout. Feedback: info@beyen.app.
```

---

## 2. English

### Name
`Beyen for TradingView (beta)`

### Short description (≤132 characters — this one is 112)
```
Log your TradingView trades into your Beyen journal: prices from your position tool and snapshots per timeframe.
```

### Detailed description
```
Beyen for TradingView puts a small panel on your TradingView chart that logs a trade straight into your own
Beyen journal.

What it does
• Reads your own long or short position tool: direction, entry, stop, target and the R:R that follows from
  them. Every value stays editable; the panel shows per field whether it came from the chart or from you.
• Shows the fields of your own journal — the same fields, groups and conditions as in the web app, including
  the fields you built yourself.
• Logs to your live journal (as a running trade) or to a backtest project, with your own risk % and notes.
• Optionally captures snapshots per timeframe (W, D, 4H and one extra slot), or takes over a TradingView
  snapshot link you paste yourself. Your original timeframe is restored afterwards.
• Doesn't double-log a double click: the same chart trade ends up in your journal once.
• Dutch and English.

What you need
A Beyen account (www.beyen.app) with beta access. You connect with a one-time link code from Settings; the
extension then holds its own session with exactly your permissions. You can disconnect at any time from the
extension.

What it doesn't do
No orders, no broker connection, no market data, no chart or replay of its own — TradingView stays where you
trade and draw; Beyen is the journal and analysis layer around it. Nothing is sent to third parties, and there
is no tracking or advertising.

Beta
This is a beta release: things still change, and TradingView updates can temporarily break reading the chart.
When that happens the panel says what to fill in by hand — you never lose a trade to a read error.
Feedback: info@beyen.app.
```

---

## 3. Permission-verantwoording (Web-Store-formulier)

Het formulier vraagt per permission één veld. Hieronder telkens de Engelse tekst die in het formulier gaat
(de review is Engelstalig), met de NL-samenvatting erboven voor de owner.

| Permission | In het manifest | Waarom |
|---|---|---|
| `storage` | ja | sessie, taalkeuze en een kleine diagnose-log lokaal bewaren |
| `alarms` | ja | de sessie op tijd verversen terwijl de service worker slaapt |
| `activeTab` | ja | één zichtbaar beeld van het huidige tabblad maken ná een klik van de gebruiker |
| `host_permissions: https://*.tradingview.com/*` | ja | het paneel tonen en de position-tool uitlezen, alleen op TradingView |

**storage**
```
The extension stores the user's own Beyen session (obtained through a one-time link code the user copies from
their Beyen account), their language preference, and a short local diagnostics log used to troubleshoot failed
reads. All of it stays in chrome.storage on the user's machine; none of it is shared with us or with third
parties.
```

**alarms**
```
The Beyen session is refreshed on a timer so the user does not get logged out while working. A Manifest V3
service worker is suspended between events, so setInterval cannot be used; a periodic alarm is the supported
way to refresh the session before it expires.
```

**activeTab**
```
Used only for the optional snapshot feature: after the user clicks the extension's toolbar icon and then
presses "Take snapshots" in the panel, the extension captures the visible area of the current TradingView tab,
crops it to the chart and stores the image in the user's own Beyen account. No capture happens without that
explicit user gesture, and no other tab is ever captured.
```

**Host permission (https://*.tradingview.com/*)**
```
The extension only works on TradingView chart pages. It injects the logging panel there and reads what the user
has drawn on their own chart: the symbol, the timeframe and the prices of their long/short position tool. It
does not read or modify any other website, and it does not read market data.
```

**Single purpose**
```
Single purpose: let a trader log the trade they are looking at on a TradingView chart into their own Beyen
trading journal, including the prices from their position tool and optional chart screenshots. Every feature of
the extension serves that one purpose.
```

**Remote code**
```
No. The extension contains no remote code: all scripts are bundled in the package, nothing is fetched and
evaluated at runtime. Network traffic is limited to the user's own Beyen backend (Supabase REST and storage).
```

**Data usage-verklaringen (aanvinken in het formulier)**
- *Personally identifiable information* — ja: het e-mailadres van het Beyen-account (om de sessie te tonen).
- *Authentication information* — ja: de sessie-tokens van het eigen Beyen-account, lokaal bewaard.
- *User activity* — nee (geen klik-, muis- of surfgedrag).
- *Website content* — ja, beperkt: het symbool/timeframe en de zelfgetekende position-tool op TradingView, plus
  een screenshot van de chart wanneer de gebruiker daarom vraagt.
- Verplichte bevestigingen: gegevens worden **niet** verkocht, **niet** gebruikt voor een doel buiten de
  hoofdfunctie, en **niet** gebruikt voor kredietwaardigheid of leningen. Alle drie aanvinken.

---

## 4. EN-tegenhanger van de privacy-alinea

`src/pages/PrivacyPage.tsx` punt 10 staat in het Nederlands, zoals de rest van die pagina (de juridische
pagina's zijn bewust nog niet vertaald). Hieronder dezelfde tekst in het Engels, voor de Web-Store-review en
om over te nemen zodra Terms/Privacy vertaald worden.

```
10. TradingView extension (beta)

If you use our Chrome extension for TradingView, the following applies. The extension is optional: it does
nothing until you install and connect it yourself.

• What it reads: only on a TradingView chart page, and only what you have put there yourself — the symbol, the
  timeframe and the prices and direction of your own position tool (entry, stop, target), plus the
  corresponding bar time. It reads no market data, no other websites and nothing outside TradingView's chart
  pages.
• What it stores: the trade you log yourself and any screenshots you have it take, in your own Beyen account —
  the same tables, storage and access control (Row Level Security) as when you enter the trade in the web app.
  A screenshot is cropped to the chart area and only uploaded when you ask for it.
• How the connection works: you generate a one-time, short-lived link code in Settings and paste it into the
  extension. That gives the extension its own session with exactly your permissions. The session is kept
  locally in your browser (chrome.storage), together with your language preference and a small technical log
  for troubleshooting. You can choose "Disconnect" in the extension at any time, which erases that local
  session.
• Where it goes: to Beyen (Supabase) only. The extension sends nothing to TradingView, to us or to third
  parties outside that own storage, contains no tracking or advertising, and does not sell or share your data.
```

⚠️ Net als de rest van Terms/Privacy is deze tekst **niet juridisch nagekeken** — meenemen in de review die
vóór de betaalde launch gepland staat, en live zetten vóór de eerste externe installatie.

---

## 5. Nog te doen door de owner

1. **Developer-account** ($5 eenmalig, identiteitsverificatie) — doorlooptijd, niet in launch-week plannen.
2. **Screenshots (1280×800 of 640×400, 1–5 stuks).** Voorstel, in deze volgorde:
   1. chart met position-tool + het paneel open op de prijzen-sectie ("via TradingView"-badges zichtbaar);
   2. het paneel met de journal-velden van een eigen journal;
   3. de snapshot-sectie met de vier slots;
   4. de succes-staat ("Trade gelogd") met de link naar Beyen;
   5. de koppelkaart in Beyen → Instellingen.
   Gebruik een demo-journal zonder echte accountnamen of bedragen in beeld.
3. **Store-icoon 128×128** — het bestaande Beyen-merkteken op een donkere achtergrond.
4. **`extension/manifest.json`**: `name` en `description` staan er nog als F2a-bouwtekst
   (`"Koppel je Beyen-journal aan TradingView. Beta — F2a: …"`). Die moeten vóór het inpakken gelijkgetrokken
   worden met de listing hierboven (naam: "Beyen voor TradingView (beta)", description: de korte beschrijving).
   *Niet gewijzigd in deze sessie: het manifest viel buiten de opdracht van dit blok.*
5. **Versienummer** in het manifest verhogen bij elke upload naar de Store.
