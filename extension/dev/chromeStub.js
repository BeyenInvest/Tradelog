// Chrome-API-stub voor het dev-harnas (harness.html). Speelt de service worker
// na met vaste antwoorden zodat het paneel (dist/content/panel.js) buiten
// Chrome om in een gewone browser-tab kan draaien — voor visuele verificatie
// van de UI zonder extensie-herlaad-cyclus. Puur dev; wordt nooit gebundeld.
(function () {
  const TINY_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const journal = {
    id: "m-1",
    naam: "Weekly Phase Method",
    assetClass: "forex",
    trackExit: false,
    fields: [
      {
        id: "f-fase", fieldKey: "fase", label: "Fase", labelKey: null, fieldType: "enum",
        options: ["Fase 1", "Fase 2", "Fase 3", "Fase 4"], required: true, isComputed: false,
        groupLabel: null, sortOrder: 0, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-weekly-criteria", fieldKey: "weekly_criteria", label: "Weekly criteria", labelKey: null, fieldType: "enum",
        options: ["High/Low", "Break/Retest"], required: false, isComputed: false,
        groupLabel: null, sortOrder: 1, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-trade-concept", fieldKey: "trade_concept", label: "Trade concept", labelKey: null, fieldType: "enum",
        options: ["Reversal", "Continuation"], required: false, isComputed: false,
        groupLabel: null, sortOrder: 2, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-entry", fieldKey: "entry", label: "Entry", labelKey: null, fieldType: "enum",
        options: ["Reversal", "Break"], required: false, isComputed: false,
        groupLabel: null, sortOrder: 3, showWhenFieldId: null, showWhenValues: null,
      },
      {
        // Machine-owned in het paneel: niet gerenderd, wél auto in custom.cc
        // (wpm-startset heeft ditzelfde veld; oefent het syncCc-pad).
        id: "f-cc", fieldKey: "cc", label: "4H Candle Close", labelKey: null, fieldType: "enum",
        options: ["03", "07", "11", "15", "19", "23"], required: false, isComputed: false,
        groupLabel: null, sortOrder: 4, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-wconf", fieldKey: "w_confirm", label: "Weekly richting mee?", labelKey: null, fieldType: "boolean",
        options: null, required: false, isComputed: false,
        groupLabel: null, sortOrder: 5, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-dconf", fieldKey: "d_confirm", label: "Daily richting mee?", labelKey: null, fieldType: "boolean",
        options: null, required: false, isComputed: false,
        groupLabel: null, sortOrder: 6, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-h4conf", fieldKey: "h4_confirm", label: "4H richting mee?", labelKey: null, fieldType: "boolean",
        options: null, required: false, isComputed: false,
        groupLabel: null, sortOrder: 7, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-extradconf", fieldKey: "extra_d_conf", label: "Extra daily confirmatie?", labelKey: null, fieldType: "boolean",
        options: null, required: false, isComputed: false,
        groupLabel: null, sortOrder: 8, showWhenFieldId: null, showWhenValues: null,
      },
      {
        // Rauwe journal-data: kenmerk + nieuws staan ná de confirms onder een
        // "Markt"-kop — exact de stand die orderedFormFields op WPM herordent.
        id: "f-weekly-kenmerk", fieldKey: "weekly_kenmerk", label: "Weekly kenmerk", labelKey: null, fieldType: "enum",
        options: ["High/Low", "Peak formation"], required: false, isComputed: false,
        groupLabel: "Markt", sortOrder: 9, showWhenFieldId: null, showWhenValues: null,
      },
      {
        id: "f-nieuws", fieldKey: "nieuws", label: "Nieuws nabij trade?", labelKey: null, fieldType: "boolean",
        options: null, required: false, isComputed: false,
        groupLabel: "Markt", sortOrder: 10, showWhenFieldId: null, showWhenValues: null,
      },
    ],
  };

  // ⚠️ Deze sleutels spiegelen de ExtRequest-union in extension/src/messages.ts
  // (plain JS, dus buiten tsc): komt daar een type bij of hernoemt er één, werk
  // dan deze map mee bij — anders valt het harnas stil terug op "onbekend type".
  const responses = {
    status: { linked: true, email: "beyenchesney@outlook.com", expiresAt: null },
    "journal-dump": {
      ok: true,
      session: { userId: "u-1", email: "beyenchesney@outlook.com", expiresAt: null },
      profile: { beta: true, methodologyId: "m-1", timezone: "Europe/Brussels" },
      journal,
    },
    targets: {
      ok: true,
      activeJournalId: "m-1",
      journals: [{ id: "m-1", naam: "Weekly Phase Method", assetClass: "forex" }],
      projects: [{ id: "p-1", naam: "Fase 2 & 3 — 80 dagen" }],
      timezone: "Europe/Brussels",
    },
    "custom-options": { ok: true, entry: ["Mijn eigen entry"], tradeConcept: ["Eigen concept"] },
    "chart-state": {
      ok: true,
      state: {
        symbol: { ok: true, value: "OANDA:AUDJPY" },
        resolution: { ok: true, value: "240" },
        tick: { ok: true, value: { size: 0.001, source: "formatter-props" } },
        positions: {
          ok: true,
          value: [{
            id: "shape-1", direction: "Long", entry: 110.33, entryTimeSec: 1789448400,
            stopLevelTicks: 500, profitLevelTicks: 1000,
            prices: { entry: 110.33, stop: 109.83, target: 111.33, plannedRR: 2 },
          }],
        },
        lastBar: { ok: true, value: { timeSec: 1789491600, close: 110.92, inReplay: false } },
      },
    },
    "log-trade": { ok: true, tradeId: "t-demo-1", duplicate: false },
    "update-trade": { ok: true, tradeId: "t-demo-1", duplicate: false },
    // Twee open trades op AUDJPY: één compleet (exit-prijs-pad) en één zonder
    // prijzen/richting (dwingt het formulier in handmatig-%-modus).
    "open-trades": {
      ok: true,
      trades: [
        {
          id: "t-demo-1", datumOpen: "2026-09-15", tijdOpen: "09:30:00", pair: "AUDJPY",
          instrument: "AUDJPY", direction: "Long", entryPrice: 110.33, stopPrice: 109.83,
          targetPrice: 111.33, riskPct: 1, importRef: "tv:demo-1", plannedRR: 2,
        },
        {
          id: "t-demo-2", datumOpen: "2026-09-16", tijdOpen: null, pair: "AUDJPY",
          instrument: "AUDJPY", direction: null, entryPrice: null, stopPrice: null,
          targetPrice: null, riskPct: null, importRef: null, plannedRR: null,
        },
      ],
    },
    "close-trade": {
      ok: true, tradeId: "t-demo-1", outcome: "Win", resultaatPct: 2, datumSluiting: "2026-09-17",
    },
    "snapshot-cycle": {
      ok: true,
      restored: true,
      slots: {
        w: { ok: true, path: "u-1/w-demo.png", bytes: 12345, thumb: TINY_PNG },
        d: { ok: true, path: "u-1/d-demo.png", bytes: 23456, thumb: TINY_PNG },
        h4: { ok: false, error: "demo: kon timeframe 240 niet zetten" },
      },
    },
    "delete-screenshots": { ok: true },
    unlink: { ok: true },
    "diag-log": { entries: [] },
  };

  const store = {};
  const changeListeners = [];

  window.chrome = {
    runtime: {
      sendMessage: (req) => {
        const body = responses[req && req.type];
        console.log("[stub] sendToSw", req, "→", body);
        return Promise.resolve(body ? JSON.parse(JSON.stringify(body)) : { ok: false, error: `stub: onbekend type ${req && req.type}` });
      },
    },
    storage: {
      local: {
        get: (key) => {
          const keys = Array.isArray(key) ? key : [key];
          const out = {};
          for (const k of keys) if (k in store) out[k] = store[k];
          return Promise.resolve(out);
        },
        set: (obj) => {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          for (const l of changeListeners) l(changes, "local");
          return Promise.resolve();
        },
        remove: (key) => {
          const keys = Array.isArray(key) ? key : [key];
          for (const k of keys) delete store[k];
          return Promise.resolve();
        },
      },
      onChanged: { addListener: (l) => changeListeners.push(l) },
    },
    i18n: { getUILanguage: () => "nl-BE" },
  };
})();
