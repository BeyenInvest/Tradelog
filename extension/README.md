# Beyen voor TradingView — Chrome-extensie (beta)

Chrome-extensie (MV3) die het Beyen-journal aan TradingView koppelt. Leidend plan: `docs/plan-tv-extensie-engines.md`; go/no-go-bewijs: `docs/spike-tv-extensie.md`.

**Status: F1b** — skelet + auth + journal-schema-dump. Nog géén chart-integratie (F2a), paneel-UI (F2d, Opus) of snapshots (F3).

## Architectuur (kort)

- `src/sw.ts` — service worker, eigenaar van de Supabase-sessie: eigen client met `chrome.storage.local`-adapter, refresh via `chrome.alarms` (50 min; `autoRefreshToken` staat uit want setInterval sterft met de MV3-SW).
- `src/db.ts` — smal `ExtensionDb`-contract; `src/supabaseDb.ts` is de echte implementatie, tests faken het interface.
- `src/linkFlow.ts` — koppel-/status-/dump-flows (pure functies over `ExtensionDb`, unit-getest).
- `src/messages.ts` — getypeerd berichtenschema popup ⇄ SW.
- `popup.html` + `src/popup.ts` — tijdelijke F1b-popup (status, koppelcode, journal-dump, diagnose-log, koppel los).
- Auth-flow: de app (F1a: `api/extension-link.ts`) geeft een eenmalige magiclink-`token_hash`; de extensie wisselt die om via `verifyOtp` → eigen sessie met eigen refresh-token-familie. Beta-gate (`beta_features || admin`) wordt bij het koppelen afgedwongen: niet-beta wordt direct weer uitgelogd.

## Bouwen & laden

Vanuit de **repo-root** (de extensie draait op de root-tooling — geen eigen package.json):

```
npm run build:ext
```

Daarna in Chrome: `chrome://extensions` → Ontwikkelaarsmodus → "Uitgepakte extensie laden" → kies de map `extension/` (het manifest verwijst naar `dist/`). Na elke rebuild: ⟳ op de extensie-kaart.

Checks: `npm run lint` dekt ook `extension/` (eigen tsconfig met chrome-types); `npm run test` draait ook `extension/src/**/*.test.ts`.

## Koppelcode genereren (tot de Settings-kaart er is — F1c)

Optie 1 — via het gedeployde endpoint (met je eigen app-JWT):

```
POST https://beyen.app/api/extension-link  (Authorization: Bearer <jouw access token>)
```

Optie 2 — lokaal, met de secret key alleen in je terminal-env (simuleert F1a):

```
$env:SUPABASE_SERVICE_ROLE_KEY = "<sb_secret key>"
node extension/tools/generate-link.mjs <jouw-email>
```

Plak de `token_hash` in de popup → "Verbind".

## Regels

- Secret keys horen nooit in deze map, het manifest of git — alleen de publieke publishable key staat in `src/config.ts`.
- Permissions minimaal houden: F1b = `storage` + `alarms`. Host-permissions op tradingview.com en `activeTab` komen pas met F2a/F3a.
- Elke profiel-query filtert op `.eq('id', uid)` — een admin ziet via RLS anders álle rijen (S0-leerpunt).
- Nieuwe blokken: eerst `docs/plan-tv-extensie-engines.md` §3 checken (volgorde + engine per blok).
