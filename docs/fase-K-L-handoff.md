# Fase K + L — startdocument (voor nieuwe sessie, model: Opus)

> Handoff geschreven 2026-08-19 na afronding van Fase J (incl. code-review-fixes,
> gemerged als `aa4b295` op main, live op prod). Werkboom was clean bij schrijven.
> Model-afspraak: K en L zijn "bekend patroon"-werk → **Opus**; raakt iets tóch de
> stats-motor, migraties of security/RLS → overleg/Fable (vuistregel van de owner).

## Werkafspraken (kort — details in CLAUDE.md, die is leidend)

- **Alles nieuws achter de beta-gate**: `useAuth().betaFeatures`. Geen uitzonderingen.
- **Migraties draait de owner zelf** via de Supabase SQL-editor (één genummerd
  bestand per wijziging, idempotent schrijven); jij verifieert daarna read-only.
  Laatste is `0038`; eerstvolgende vrije nummer is `0039`.
- Branch per fase (bv. `fase-k-screenshots`), commit alleen op expliciete vraag,
  `npm run lint` + `test` + `build` clean vóór "klaar".
- Missed trades nooit in echte stats (helpers in `src/lib/stats/core.ts`);
  `TradesApi` is één gedeelde instantie per pagina.

## Fase K — Screenshot-upload (1-2 sessies) — QoL-#1

Doel: Ctrl+V/upload van een chart-screenshot i.p.v. de vier URL-velden.
**Klaar wanneer:** Ctrl+V van een TradingView-chart in het trade-formulier werkt
en de screenshot toont in trade-detail én in de review-PDF.

1. **Supabase Storage-bucket** (`0039`): bucket `screenshots`, per-user RLS
   (pad-conventie `user_id/...`), size/mime-limieten. Let op het bestaande
   patroon: expliciete grants/revokes zoals in 0038 (anon niets).
2. **Upload + paste-from-clipboard** in het trade-formulier. Bestaande plekken:
   - `trades.*_screenshot` kolommen (W/D/H4/H2, `src/lib/types.ts:51-54`) zijn nu
     tekst-URL's, gerenderd via `UrlPreviewField.tsx` in
     `src/components/trades/TradeFormSections/TechnicalSection.tsx`.
   - Ook uitgelezen in `ReadOnlyTradeDetailModal.tsx` (admin) en de PDF-datalaag
     (`src/lib/pdf/reviewPdfData.ts`).
3. **Vrije screenshot-lijst** (cyclus 5-restje uit
   `docs/ontwerp-configureerbaar-journal.md`, regel 39/253): n screenshots met
   eigen label i.p.v. de vier vaste WPM-timeframe-slots. De vier bestaande
   kolommen blijven staan (legacy, droppen is Fase P/cyclus 10) — nieuw werk in
   een aparte tabel (bv. `trade_screenshots`: id, trade_id, user_id, label,
   storage_path, positie) of jsonb; kies additief, niets breken.
4. **Lightbox/preview** in trade-detail en review.
5. PDF: react-pdf kan afbeeldingen embedden; let op de CSP in `vercel.json`
   (zie memory: 'wasm-unsafe-eval' moet blijven) en op de Storage-URL-vorm
   (signed URL's vs public bucket — privacy: signed).

## Fase L — Mobile-instap: PWA + quick-log (1-2 sessies)

**Klaar wanneer:** de app is installeerbaar op een telefoon en een trade is in
<30 sec gelogd.

1. **PWA-manifest + service worker** (vite-plugin-pwa is de gebaande weg).
   Icon = gold shield: er zijn géén losse PNG's meer in `public/` (alleen
   `favicon.svg`); het merk leeft in `src/components/ui/Logo.tsx` — maskable
   PNG-iconen (192/512) moeten nog gegenereerd worden.
   Service worker conservatief houden: geen agressieve caching van Supabase-calls.
2. **Quick-log-formulier**: minimale velden (instrument, richting, resultaat,
   evaluatie) om direct na de sessie te loggen; details later aanvullen. Bedient
   ook de geparkeerde scalper-wens (quick-add). Hergebruik de bestaande
   TradeForm-secties/validatie (`tradeSchema`) — geen tweede waarheid bouwen;
   verplichte DB-velden krijgen dezelfde stille defaults als de import
   (`dealToImportRow` in `src/lib/import/mapToTrade.ts` is het voorbeeld:
   fase "Fase 1", cc "11", enz.).
3. Mobile-viewport nalopen van de geraakte schermen (de kalender heeft al een
   mobiel dot-patroon als voorbeeld).

## Volgorde-advies binnen de sessie

K eerst (afgebakend, eigen migratie), dan L. Elke fase zelfstandig deploybaar.
Na afronding: `/code-review` over de branch (zoals bij Fase J — dat ving 14
echte fouten), dan pas mergen.
