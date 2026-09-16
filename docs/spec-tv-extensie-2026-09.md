# Spec — Beyen TradingView-extensie ("Log-in-journal-from-chart")

> ⚠️ **Deze spec is deels gecorrigeerd.** Fable heeft 'm getoetst tegen de echte codebase en meerdere claims rechtgezet (geen prijskolommen → migratie nodig; auth-flow via `generateLink`/`verifyOtp` i.p.v. "PKCE-exchange"; chart-lezen via `window.TradingViewApi`; 4 vaste snapshot-slots; open-trade-flow + backtest-projecten ontbraken). **Leidend = `docs/plan-tv-extensie-engines.md`** — lees dat vóór je hieruit bouwt.


**Status:** roadmap-kandidaat, **niet gebouwd**, **niet in de feature-freeze**.
**Aanleiding:** owner zag de Archer-extensie live (Zoom-share, 2026-09-15); bespaart ~2u weg-en-weer-klikken op een 100-backtest-project. Niemand behalve Archer (intern) heeft dit → sterke differentiator/moat.
**Aanbeveling (Opus, 2026-09-15):** de freeze niet breken; dit is het grootste nieuwe oppervlak dat we zouden toevoegen (aparte codebase + Web Store-review + security-surface + doorlopend TV-DOM-onderhoud). Positioneren als **roadmap #1 ná de beta-launch**, mét deze spec als startpunt. Dit doc is docs-only en commit géén code.

Filosofisch: **geen conflict** met de "geen replay-engine, ooit"-regel. Dit is import-automatisering (chart → journal), geen eigen chart/replay. Past exact bij "TradingView is king, Beyen = analyse-laag erbovenop".

---

## 1. Wat de referentie (Archer) doet — geobserveerd 2026-09-15

Een "Log in Journal v1.5.6"-paneel dat als overlay óver tradingview.com ligt (content script, geen officiële TV-API — die bestaat niet). Waargenomen gedrag:

- **Auto-fill uit de chart:** symbol (`OANDA:NZDCHF`), entry/SL/TP-prijzen uit de position/long-short-tekentool, afgeleide **pips** en **R:R**, entry-timestamp. Label "via TradingView".
- **Classificatie-dropdowns** (bij Archer hardcoded naar hún methodiek): Type (FX), Result (Win/Loss), Weekly Fase (1–4), Weekly Zone Scenario, Daily Scenario, Entry Type, Position Management.
- **Snapshots** per timeframe (Weekly / Daily / 4H), met per snapshot twee bronnen:
  - *Auto Canvas* — de chart-canvas direct naar een afbeelding gecapt.
  - *Manual Link* — TV's eigen snapshot-URL (`tradingview.com/x/…`).
  - Geüpload naar **Supabase storage** (Archer draait ook op Supabase).
- **Log trade** schrijft de rij weg naar hun journal-DB.
- Rechterpaneel toont watchlist + per-symbool notes (Weekly/Daily bias).

## 2. Waar Beyen structureel wint

Archer's dropdowns zijn **vast** ingebakken in de extensie. Beyen heeft al **`methodologies` + `methodology_fields`** (per-user, per-journal configureerbaar, custom velden in `trades.custom`). Dus:

> De extensie bouwt géén velden na. Hij haalt het **journal-veldschema van de ingelogde user op via de API** en rendert de classificatie-form dynamisch. Eén extensie werkt voor élke gebruiker en élke methodiek — Archer moet per methodiek hercoderen.

Dat is de kern van het verkoopverhaal: "werkt met jouw eigen journal-opzet", niet met één opgelegde methode.

## 3. Architectuur

### 3.1 Onderdelen
- **Chrome-extensie, Manifest V3.**
  - `content_script` op `https://*.tradingview.com/chart/*`: injecteert het paneel (shadow-DOM om TV's CSS niet te raken), leest de chart-state, triggert snapshots.
  - `service_worker` (background): auth-sessie, API-calls naar Supabase/Beyen, upload-queue.
  - Optioneel `popup`: login-status + link naar app.
- **Beyen-app:** één nieuw stukje UI (Settings → "Verbind TradingView-extensie") dat een **kortlevend koppeltoken** genereert, plus de bestaande journal-API die de extensie leest/schrijft.

### 3.2 Auth (belangrijkste ontwerpkeuze)
**Niet** de Supabase-sessie uit de web-app stelen of cookies delen. In plaats daarvan:
1. User klikt in de app "Verbind extensie" → app toont een eenmalige, kortlevende code / deep-link.
2. Extensie wisselt die in voor een **eigen Supabase-sessie via PKCE** (`signInWithOtp`/token-exchange), opgeslagen in `chrome.storage` (niet `localStorage` van TV's origin).
3. Alle writes lopen via de bestaande **RLS** (`user_id = auth.uid()`) — de extensie krijgt geen bredere rechten dan de user zelf.
4. Refresh-token-rotatie in de service worker; revoke = uitloggen in de app of een "koppel los"-knop.

> Onder geen beding TV's DOM/cookies gebruiken om aan credentials te komen, en geen wachtwoorden in de extensie. Zie ook de projectregels rond credentials.

### 3.3 Chart-state lezen
TradingView heeft geen publieke API voor de chart-inhoud. Twee lagen, met fallback:
- **Voorkeur:** de position/long-short-tekentool uitlezen (entry/SL/TP + richting) — dat is precies de data die de trader al intekent. Onderzoek of TV's `widget`-postMessage of de tekentool-DOM dit stabiel geeft.
- **Fallback / handmatig:** velden die niet betrouwbaar te scrapen zijn, laat de user in het paneel bevestigen (symbol + timeframe zijn wél stabiel uit URL/DOM).
- **Afgeleide waarden** (pips, R:R) berekent Beyen zelf uit entry/SL/TP + instrument-metadata (pip-size per symbool), niet uit TV — sluit aan bij onze bestaande stats-laag.

⚠️ **Dit is de onderhoudspost.** TV wijzigt z'n DOM zonder aankondiging. Nodig: een dunne, goed-geïsoleerde "adapter"-laag met selectors op één plek, en een zichtbare "kon chart niet lezen — vul handmatig in"-degradatie i.p.v. een stille crash.

### 3.4 Snapshots
- Per gekozen timeframe: schakel TV naar die TF, capture, terug.
- **Auto Canvas:** `<canvas>.toDataURL()` / `toBlob()` → upload. Snel, maar kan CORS-getainte canvas geven (TV-tiles van andere origin). Testen; anders:
- **TV-snapshot-link:** TV's eigen "snapshot" (camera) genereert `tradingview.com/x/<id>` + een image-URL — die URL opslaan is robuuster en goedkoper, maar hangt van TV af en toont hun watermark.
- Upload naar **bestaande** screenshots-storage (migratie 0039 legde screenshots al aan; hergebruik dat pad i.p.v. een nieuwe bucket). Koppel aan de trade-rij zoals de app dat nu al doet.

### 3.5 Schrijven naar het journal
- Extensie POST't een trade-concept naar dezelfde endpoints/tabellen als de web-`TradesApi`. Markeer herkomst (bv. `source = 'tv-extension'`) zodat we later import-kwaliteit kunnen meten.
- **Idempotentie:** voorkom dubbele logs bij dubbelklik/queue-retry (client-side UUID + upsert).

## 4. Beta-gating & rollout
- Start achter **`useAuth().betaFeatures`** (conform de omgedraaide gating-regel: alles nieuws eerst beta). De extensie checkt de flag bij connect en weigert netjes als de user niet in de beta zit.
- Distributie eerst als **unlisted/private** Web Store-item (of dev-mode load) voor de betacohort, pas daarna publieke listing.

## 5. Security & privacy-checklist (blocking vóór publiek)
- MV3, minimale `host_permissions` (alleen `*.tradingview.com` + de Beyen/Supabase-origins). Geen `<all_urls>`.
- Geen `eval`/remote code; alle logica in het extensiepakket (Web Store-review eist dit sowieso).
- Geen scraping van iets anders dan de trade-setup; geen TV-account-data, geen browserhistory.
- CSP van de extensie strak; content script in shadow-DOM.
- Volledige `security-review` (skill) op het extensiepakket vóór listing.
- Privacy: documenteer in Terms/Privacy dat de extensie chart-setup + snapshots naar de eigen journal stuurt. (Terms/Privacy nog niet juridisch gereviewd — zie CLAUDE.md.)

## 6. Open risico's / te valideren
1. **TV-DOM-stabiliteit** — grootste. Hoeveel breekt er per TV-release? Adapter + telemetry op leesfouten.
2. **Canvas-CORS** — is `toDataURL` bruikbaar of moeten we op TV's snapshot-URL leunen?
3. **Web Store-reviewtijd** — buiten onze controle (dagen–weken); plan eromheen, niet in launch-week.
4. **Onderhoudslast** vs. teamgrootte (owner solo). Realistisch: dit is fase-formaat werk, niet een middag.
5. **Firefox/Edge** later? MV3 is grotendeels porteerbaar, maar scope eerst Chrome.

## 7. Voorgesteld faseplan (ná launch)
- **F1 — Verbinden + auth:** app-side koppel-UI + PKCE-sessie in extensie, "hello world"-paneel dat het journal-schema ophaalt en toont. Geen writes.
- **F2 — Auto-fill + handmatig loggen:** chart-adapter (entry/SL/TP/symbol/TF) → dynamische form uit `methodology_fields` → trade wegschrijven via bestaande API (idempotent, `source='tv-extension'`).
- **F3 — Snapshots:** multi-TF capture → bestaande screenshots-storage → koppelen aan trade.
- **F4 — Polish + beta-distributie:** foutdegradatie, queue/retry, unlisted Web Store, security-review, docs.

## 8. Migraties
Waarschijnlijk minimaal: hooguit een `trades.source`-kolom en hergebruik van de bestaande screenshots-storage (0039). **Geen** migratienummer reserveren tot F2 daadwerkelijk start — pak op dat moment het eerstvolgende vrije nummer uit het fixplan.

---

*Referentie-observaties: memory `beyen-archer-tv-extension`. Non-goal-regel: memory `beyen-no-replay-engine`. Gating-regel: memory `beyen-launch-stappenplan`.*
