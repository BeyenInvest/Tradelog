// Mini-i18n van de extensie (F4b). Waarom een eigen laagje en niet i18next uit
// de web-app: de extensie draait in drie werelden (popup, content script,
// service worker), moet in een IIFE-bundel van kilobytes passen en heeft geen
// React — een getypte woordenlijst plus t() dekt alles wat we tonen.
//
// Vier regels die de vorm verklaren:
//  1. Trading-leenwoorden blijven in beide talen identiek (Win/Loss/BE,
//     Long/Short, "Log trade", entry/stop/target, R:R) — zelfde afspraak als het
//     `enums`-namespace van de web-app.
//  2. NL is de statische fallback (zoals numberLocale() in de app). De echte
//     keuze staat in chrome.storage.local onder "lang"; staat die er niet, dan
//     beslist de UI-taal van Chrome (nl* → nl, al de rest → en).
//  3. t() is synchroon en leest een gecachete taal. Elke weergavelaag haalt de
//     taal één keer op bij mount (ensureLang) en hertekent bij een wissel
//     (onLangChange) — zo hoeft geen enkele render-functie async te worden.
//  4. `en` is getypt als Record<MessageKey, string>: een sleutel die in NL
//     bijkomt en in EN ontbreekt is een compile-fout, geen stille NL-zin in een
//     Engels paneel.

export type Lang = "nl" | "en";

export const LANGS: readonly Lang[] = ["nl", "en"];

/** Sleutel in chrome.storage.local; gedeeld door popup en content-scripts. */
export const LANG_STORAGE_KEY = "lang";

export function isLang(value: unknown): value is Lang {
  return value === "nl" || value === "en";
}

/**
 * Chrome's UI-taal → onze taal. Puur, want dit is de enige plek waar een
 * willekeurige BCP-47-string ("nl-BE", "en-US", "fr") een keuze wordt.
 * Alles wat met nl begint is Nederlands; al de rest krijgt Engels.
 */
export function resolveLang(uiLanguage: string | null | undefined): Lang {
  if (typeof uiLanguage !== "string") return "en";
  return /^nl(\b|[-_])/i.test(uiLanguage.trim()) ? "nl" : "en";
}

/** "{count} tools" + { count: 2 } → "2 tools". Onbekende placeholders blijven staan. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

// ── Woordenlijst ────────────────────────────────────────────────────────────

const NL = {
  // Popup
  "popup.docTitle": "Beyen voor TradingView",
  "popup.langLabel": "Taal",
  "popup.statusLoading": "Status ophalen…",
  "popup.statusLinked": "Gekoppeld als {email}",
  "popup.statusNotLinked": "Niet gekoppeld",
  "popup.statusLinking": "Koppelen…",
  "popup.codeLabel": "Koppelcode",
  "popup.codePlaceholder": "Plak hier je koppelcode",
  "popup.connect": "Verbind",
  "popup.linkHint":
    "Genereer de koppelcode in Beyen → Instellingen → \"Verbind TradingView-extensie\" en plak 'm hier binnen een paar minuten.",
  "popup.readChart": "Lees chart",
  "popup.journalSchema": "Journal-schema",
  "popup.diagLog": "Diagnose-log",
  "popup.unlink": "Koppel los",
  "popup.linkedHint":
    "Loggen doe je in het paneel op je TradingView-chart — klik daar rechtsboven op het Beyen-knopje.",
  "popup.error": "FOUT: {detail}",

  // Paneel — host, staten, kop
  "panel.launcher": "Beyen — trade loggen",
  "panel.close": "Paneel sluiten",
  "panel.booting.title": "Verbinden…",
  "panel.booting.text": "Even je Beyen-account controleren.",
  "panel.notLinked.title": "Nog niet gekoppeld",
  "panel.notLinked.text":
    "Open de extensie-popup (het Beyen-icoon in je Chrome-werkbalk) en plak daar de koppelcode uit Beyen → Instellingen. Daarna log je vanaf deze chart rechtstreeks in je journal.",
  "panel.notLinked.retry": "Opnieuw controleren",
  "panel.reload.title": "Extensie herladen",
  "panel.reload.text":
    "De achtergrond van de extensie is opnieuw gestart. Ververs deze TradingView-pagina om het paneel weer te verbinden.",
  "panel.reload.short": "De extensie is herladen — ververs deze TradingView-pagina.",
  "panel.reload.retry": "De extensie is herladen — ververs deze TradingView-pagina en probeer opnieuw.",

  // Paneel — onboarding
  "onb.title": "In drie stappen",
  "onb.step1": "Koppel eerst: Beyen → Instellingen → koppelcode → plak 'm in de extensie-popup bij \"Verbind\".",
  "onb.step2":
    "Teken een long- of short-position-tool op je chart; dit paneel leest entry, stop, target en richting er vanzelf uit.",
  "onb.step3":
    "Wil je snapshots? Klik één keer op het Beyen-icoon in je Chrome-werkbalk (dat vraagt Chrome zelf) en gebruik daarna \"Maak snapshots\".",
  "onb.dismiss": "Begrepen",

  // Paneel — secties
  "panel.sec.chart": "Chart",
  "panel.sec.position": "Position-tool",
  "panel.sec.target": "Doel",
  "panel.sec.mode": "Modus",
  "panel.sec.journal": "Journal-velden",
  "panel.sec.extra": "Extra",

  // Paneel — chart
  "panel.refresh": "Ververs chart",
  "panel.refreshTitle": "Chart opnieuw lezen",
  "panel.chartLoading": "Chart lezen…",

  // Paneel — position-tool
  "panel.noPositions":
    "Teken een long- of short-position-tool op de chart en ververs — dan vult Beyen richting, entry, stop, target en R:R vanzelf in.",
  "panel.positionPick": "{count} position-tools op deze chart — kies er één.",
  "panel.positionSelectLabel": "Kies de position-tool",
  "panel.positionOption": "{direction} · entry {price}",
  "panel.metric.direction": "Richting",
  "panel.metric.entry": "Entry",
  "panel.metric.stop": "Stop",
  "panel.metric.target": "Target",
  "panel.metric.rr": "R:R",
  "panel.metric.time": "Tijd",
  "panel.src.tv": "via TradingView",
  "panel.src.manual": "handmatig",
  "panel.src.computed": "berekend",
  "panel.editTitle": "{label} handmatig invullen",
  "panel.editPlaceholder": "{label} handmatig",
  "panel.noTickPrices": "Prijzen niet berekenbaar (tick-size onbekend) — vul entry en stop handmatig in.",
  "panel.manualTimeLabel": "Datum en tijd van de entry",
  "panel.manualTimeHint": "De chart geeft hier geen bar-tijd — vul 'm zelf in (in je eigen tijdzone uit Beyen).",

  // Paneel — doel
  "panel.targetSelectLabel": "Waar komt deze trade terecht",
  "panel.targetLive": "Journal (live)",
  "panel.targetProject": "Backtest: {name}",
  "panel.activeJournal": "Actief journal: {name}",
  "panel.targetsFailed": "Backtest-projecten konden niet geladen worden.",

  // Paneel — modus
  "panel.modeLabel": "Modus",
  "panel.modeLive": "Live (open trade)",
  "panel.modeBacktest": "Backtest (met resultaat)",
  "panel.modeLiveHint": "De trade komt als lopend in je journal; het resultaat vul je later in Beyen aan.",
  "panel.resultLabel": "Resultaat %",
  "panel.resultPlaceholder": "bv. 1.8 of -0.5",

  // Paneel — journal-velden
  "panel.noJournalFields": "Dit journal heeft geen eigen velden.",
  "panel.journalMissing": "Je hebt nog geen actief journal in Beyen — de trade wordt zonder journal-velden gelogd.",
  "panel.journalLoadFailed": "Journal-velden konden niet geladen worden ({error}) — loggen kan wel.",
  "panel.legacySkipped":
    "De WPM-kenmerken ({fields}) vul je na het loggen in Beyen aan — die horen bij vaste kolommen, niet bij de custom velden.",

  // Paneel — extra
  "panel.riskLabel": "Risico %",
  "panel.riskPlaceholder": "standaard 1%",
  "panel.notesLabel": "Notities",
  "panel.notesPlaceholder": "Wat zag je hier?",

  // Paneel — verzenden
  "panel.submit": "Log trade",
  "panel.submitBusy": "Loggen…",
  "panel.v.noSymbol": "Zonder symbool kan er niets gelogd worden — ververs de chart.",
  "panel.v.entryStopPair": "Vul entry én stop in — met maar één van de twee valt er geen R te berekenen.",
  "panel.v.needDateTime": "Vul de datum en tijd van de entry in.",
  "panel.v.pickOutcome": "Kies Win, Loss of BE.",
  "panel.v.needResult": "Vul het resultaat in % in.",
  "panel.v.lossNegative": "Een Loss hoort een negatief resultaat te hebben.",
  "panel.v.winPositive": "Een Win hoort een positief resultaat te hebben.",
  "panel.v.missingRequired": "Nog verplicht: {fields}.",
  "panel.v.riskNaN": "Risico % is geen getal.",
  "panel.v.riskPositive": "Risico % moet groter dan 0 zijn.",

  // Paneel — succes
  "panel.success.title": "Trade gelogd",
  "panel.success.text": "De trade staat in je Beyen-journal.",
  "panel.duplicate.title": "Deze trade was al gelogd",
  "panel.duplicate.text": "Dezelfde chart-trade stond al in je journal — er is niets dubbel aangemaakt.",
  "panel.success.open": "Open in Beyen",
  "panel.success.again": "Nog één loggen",

  // Dynamische form
  "form.choose": "— kies —",
  "form.yes": "Ja",
  "form.no": "Nee",

  // Snapshots
  "snap.title": "Snapshots",
  "snap.intro":
    "Beyen zet de chart even op elk aangezet timeframe, maakt een beeld en zet je eigen timeframe daarna terug.",
  "snap.run": "Maak snapshots",
  "snap.runBusy": "Snapshots maken…",
  "snap.busyLine": "Snapshots maken — de chart wisselt even van timeframe…",
  "snap.gesture":
    "Chrome vraagt eerst een klik op het Beyen-icoon in je werkbalk (eenmalig per tab) — klik daar en probeer opnieuw",
  "snap.retry": "Opnieuw",
  "snap.notRestored": "Het timeframe van de chart is niet teruggezet — zet 'm zelf terug voor je verder kijkt.",
  "snap.noneAuto": "Geen enkel slot staat op automatisch — zet er één aan, of plak links.",
  "snap.linkPlaceholder": "https://… (TradingView-snapshot)",
  "snap.linkTitle": "Link plakken",
  "snap.linkAria": "Link plakken voor {slot}",
  "snap.retryTitle": "Alleen dit timeframe opnieuw",
  "snap.retryAria": "Snapshot opnieuw maken voor {slot}",
  "snap.status.auto": "Wordt meegenomen bij 'Maak snapshots'.",
  "snap.status.link": "Geplakte link gaat mee — dit slot doet niet mee met de cyclus.",
  "snap.status.badLink": "Geen geldige link — plak een adres dat met https:// begint.",
  "snap.notRun": "niet uitgevoerd — de cyclus stopte eerder",

  // Foutcopy van het schrijfpad
  "err.notLinked": "Niet gekoppeld — open de extensie-popup en verbind je Beyen-account.",
  "err.notBeta": "De TradingView-extensie is nog beta-only voor dit account.",
  "err.profileUnreadable": "Je Beyen-profiel is niet leesbaar — koppel de extensie opnieuw.",
  "err.symbolNotInPairs":
    "{symbol} zit niet in de forex-lijst van dit journal — kies handmatig of log in een ander journal.",
  "err.symbolFallback": "Dit symbool",
  "err.symbolUnreadable": "Het symbool van deze chart is onleesbaar.",
  "err.directionMismatch":
    "Richting en prijzen spreken elkaar tegen: bij een Long hoort de stop ónder de entry, bij een Short erboven. Pas de richting of de prijzen aan.",
  "err.stopEqualsEntry": "Stop en entry zijn gelijk — zonder risico-afstand is er geen R te berekenen.",
  "err.noEntryTime": "Geen tijd gevonden bij de position-tool — vul datum en tijd handmatig in.",
  "err.emptyClientUuid": "Interne fout: geen idempotentie-sleutel. Sluit het paneel en probeer opnieuw.",
  "err.missingColumn": "De database mist nog migratie 0058 — draai die eerst.",
  "err.constraint": "De database weigerde deze trade.",
  "err.schemaInvalid": "De trade komt niet door de controles.",
  "err.generic": "Loggen is niet gelukt.",

  // Foutcopy — veldnamen en zod-zinnen
  "err.field.resultaat_pct": "Resultaat %",
  "err.field.risk_pct": "Risico %",
  "err.field.outcome": "Uitkomst",
  "err.field.direction": "Richting",
  "err.field.datum_open": "Datum",
  "err.field.tijd_open": "Tijd",
  "err.field.datum_sluiting": "Sluitdatum",
  "err.field.planned_rr": "R:R",
  "err.field.entry_price": "Entry",
  "err.field.stop_price": "Stop",
  "err.field.target_price": "Target",
  "err.field.pair": "Pair",
  "err.field.instrument": "Instrument",
  "err.field.fase": "Fase",
  "err.schema.required": "is verplicht",
  "err.schema.closeBeforeOpen": "ligt vóór de opening",
  "err.schema.riskMustBePositive": "moet groter dan 0 zijn",
  "err.schema.excursionMustBePositive": "mag niet negatief zijn",
  "err.schema.lossMustBeNegative": "hoort bij een Loss negatief te zijn",
  "err.schema.winMustBePositive": "hoort bij een Win positief te zijn",
} as const;

export type MessageKey = keyof typeof NL;

const EN: Record<MessageKey, string> = {
  // Popup
  "popup.docTitle": "Beyen for TradingView",
  "popup.langLabel": "Language",
  "popup.statusLoading": "Checking status…",
  "popup.statusLinked": "Connected as {email}",
  "popup.statusNotLinked": "Not connected",
  "popup.statusLinking": "Connecting…",
  "popup.codeLabel": "Link code",
  "popup.codePlaceholder": "Paste your link code here",
  "popup.connect": "Connect",
  "popup.linkHint":
    "Generate the link code in Beyen → Settings → \"Connect TradingView extension\" and paste it here within a few minutes.",
  "popup.readChart": "Read chart",
  "popup.journalSchema": "Journal schema",
  "popup.diagLog": "Diagnostics log",
  "popup.unlink": "Disconnect",
  "popup.linkedHint":
    "You log trades in the panel on your TradingView chart — click the Beyen button at the top right there.",
  "popup.error": "ERROR: {detail}",

  // Panel — host, states, header
  "panel.launcher": "Beyen — log a trade",
  "panel.close": "Close panel",
  "panel.booting.title": "Connecting…",
  "panel.booting.text": "Just checking your Beyen account.",
  "panel.notLinked.title": "Not connected yet",
  "panel.notLinked.text":
    "Open the extension popup (the Beyen icon in your Chrome toolbar) and paste the link code from Beyen → Settings there. After that you log straight into your journal from this chart.",
  "panel.notLinked.retry": "Check again",
  "panel.reload.title": "Extension reloaded",
  "panel.reload.text":
    "The extension's background was restarted. Reload this TradingView page to reconnect the panel.",
  "panel.reload.short": "The extension was reloaded — refresh this TradingView page.",
  "panel.reload.retry": "The extension was reloaded — refresh this TradingView page and try again.",

  // Panel — onboarding
  "onb.title": "In three steps",
  "onb.step1": "Connect first: Beyen → Settings → link code → paste it into the extension popup under \"Connect\".",
  "onb.step2":
    "Draw a long or short position tool on your chart; this panel reads entry, stop, target and direction from it automatically.",
  "onb.step3":
    "Want snapshots? Click the Beyen icon in your Chrome toolbar once (Chrome itself asks for that), then use \"Take snapshots\".",
  "onb.dismiss": "Got it",

  // Panel — sections
  "panel.sec.chart": "Chart",
  "panel.sec.position": "Position tool",
  "panel.sec.target": "Destination",
  "panel.sec.mode": "Mode",
  "panel.sec.journal": "Journal fields",
  "panel.sec.extra": "Extra",

  // Panel — chart
  "panel.refresh": "Refresh chart",
  "panel.refreshTitle": "Read the chart again",
  "panel.chartLoading": "Reading chart…",

  // Panel — position tool
  "panel.noPositions":
    "Draw a long or short position tool on the chart and refresh — Beyen then fills in direction, entry, stop, target and R:R by itself.",
  "panel.positionPick": "{count} position tools on this chart — pick one.",
  "panel.positionSelectLabel": "Pick the position tool",
  "panel.positionOption": "{direction} · entry {price}",
  "panel.metric.direction": "Direction",
  "panel.metric.entry": "Entry",
  "panel.metric.stop": "Stop",
  "panel.metric.target": "Target",
  "panel.metric.rr": "R:R",
  "panel.metric.time": "Time",
  "panel.src.tv": "from TradingView",
  "panel.src.manual": "manual",
  "panel.src.computed": "calculated",
  "panel.editTitle": "Enter {label} manually",
  "panel.editPlaceholder": "{label} manually",
  "panel.noTickPrices": "Prices can't be computed (tick size unknown) — fill in entry and stop manually.",
  "panel.manualTimeLabel": "Date and time of the entry",
  "panel.manualTimeHint":
    "The chart gives no bar time here — fill it in yourself (in your own timezone from Beyen).",

  // Panel — destination
  "panel.targetSelectLabel": "Where this trade lands",
  "panel.targetLive": "Journal (live)",
  "panel.targetProject": "Backtest: {name}",
  "panel.activeJournal": "Active journal: {name}",
  "panel.targetsFailed": "Backtest projects could not be loaded.",

  // Panel — mode
  "panel.modeLabel": "Mode",
  "panel.modeLive": "Live (open trade)",
  "panel.modeBacktest": "Backtest (with result)",
  "panel.modeLiveHint": "The trade lands in your journal as running; you add the result later in Beyen.",
  "panel.resultLabel": "Result %",
  "panel.resultPlaceholder": "e.g. 1.8 or -0.5",

  // Panel — journal fields
  "panel.noJournalFields": "This journal has no fields of its own.",
  "panel.journalMissing":
    "You don't have an active journal in Beyen yet — the trade is logged without journal fields.",
  "panel.journalLoadFailed": "Journal fields could not be loaded ({error}) — logging still works.",
  "panel.legacySkipped":
    "You add the WPM characteristics ({fields}) in Beyen after logging — those belong to fixed columns, not to the custom fields.",

  // Panel — extra
  "panel.riskLabel": "Risk %",
  "panel.riskPlaceholder": "default 1%",
  "panel.notesLabel": "Notes",
  "panel.notesPlaceholder": "What did you see here?",

  // Panel — submitting
  "panel.submit": "Log trade",
  "panel.submitBusy": "Logging…",
  "panel.v.noSymbol": "Without a symbol there is nothing to log — refresh the chart.",
  "panel.v.entryStopPair": "Fill in both entry and stop — with just one of the two there is no R to compute.",
  "panel.v.needDateTime": "Fill in the date and time of the entry.",
  "panel.v.pickOutcome": "Pick Win, Loss or BE.",
  "panel.v.needResult": "Fill in the result in %.",
  "panel.v.lossNegative": "A Loss should carry a negative result.",
  "panel.v.winPositive": "A Win should carry a positive result.",
  "panel.v.missingRequired": "Still required: {fields}.",
  "panel.v.riskNaN": "Risk % is not a number.",
  "panel.v.riskPositive": "Risk % must be greater than 0.",

  // Panel — success
  "panel.success.title": "Trade logged",
  "panel.success.text": "The trade is in your Beyen journal.",
  "panel.duplicate.title": "This trade was already logged",
  "panel.duplicate.text": "The same chart trade was already in your journal — nothing was created twice.",
  "panel.success.open": "Open in Beyen",
  "panel.success.again": "Log another",

  // Dynamic form
  "form.choose": "— pick —",
  "form.yes": "Yes",
  "form.no": "No",

  // Snapshots
  "snap.title": "Snapshots",
  "snap.intro":
    "Beyen briefly switches the chart to each enabled timeframe, captures an image and puts your own timeframe back.",
  "snap.run": "Take snapshots",
  "snap.runBusy": "Taking snapshots…",
  "snap.busyLine": "Taking snapshots — the chart switches timeframe for a moment…",
  "snap.gesture":
    "Chrome first wants a click on the Beyen icon in your toolbar (once per tab) — click it and try again",
  "snap.retry": "Try again",
  "snap.notRestored": "The chart's timeframe was not restored — set it back yourself before you read on.",
  "snap.noneAuto": "No slot is set to automatic — switch one on, or paste links.",
  "snap.linkPlaceholder": "https://… (TradingView snapshot)",
  "snap.linkTitle": "Paste link",
  "snap.linkAria": "Paste a link for {slot}",
  "snap.retryTitle": "Redo just this timeframe",
  "snap.retryAria": "Take the snapshot for {slot} again",
  "snap.status.auto": "Will be included with 'Take snapshots'.",
  "snap.status.link": "The pasted link goes along — this slot sits out the cycle.",
  "snap.status.badLink": "Not a usable link — paste an address that starts with https://.",
  "snap.notRun": "not run — the cycle stopped earlier",

  // Error copy of the write path
  "err.notLinked": "Not connected — open the extension popup and connect your Beyen account.",
  "err.notBeta": "The TradingView extension is still beta-only for this account.",
  "err.profileUnreadable": "Your Beyen profile can't be read — connect the extension again.",
  "err.symbolNotInPairs":
    "{symbol} is not in this journal's forex list — pick one manually or log into another journal.",
  "err.symbolFallback": "This symbol",
  "err.symbolUnreadable": "The symbol of this chart can't be read.",
  "err.directionMismatch":
    "Direction and prices contradict each other: on a Long the stop belongs below the entry, on a Short above it. Adjust the direction or the prices.",
  "err.stopEqualsEntry": "Stop and entry are equal — without risk distance there is no R to compute.",
  "err.noEntryTime": "No time found on the position tool — fill in date and time manually.",
  "err.emptyClientUuid": "Internal error: no idempotency key. Close the panel and try again.",
  "err.missingColumn": "The database is still missing migration 0058 — run that one first.",
  "err.constraint": "The database refused this trade.",
  "err.schemaInvalid": "The trade doesn't pass the checks.",
  "err.generic": "Logging failed.",

  // Error copy — field names and zod sentences
  "err.field.resultaat_pct": "Result %",
  "err.field.risk_pct": "Risk %",
  "err.field.outcome": "Outcome",
  "err.field.direction": "Direction",
  "err.field.datum_open": "Date",
  "err.field.tijd_open": "Time",
  "err.field.datum_sluiting": "Close date",
  "err.field.planned_rr": "R:R",
  "err.field.entry_price": "Entry",
  "err.field.stop_price": "Stop",
  "err.field.target_price": "Target",
  "err.field.pair": "Pair",
  "err.field.instrument": "Instrument",
  "err.field.fase": "Phase",
  "err.schema.required": "is required",
  "err.schema.closeBeforeOpen": "lies before the opening",
  "err.schema.riskMustBePositive": "must be greater than 0",
  "err.schema.excursionMustBePositive": "may not be negative",
  "err.schema.lossMustBeNegative": "should be negative on a Loss",
  "err.schema.winMustBePositive": "should be positive on a Win",
};

const DICTS: Record<Lang, Record<MessageKey, string>> = { nl: NL, en: EN };

// ── Taalkeuze (cache + chrome.storage) ──────────────────────────────────────

let current: Lang = "nl";
const listeners = new Set<(lang: Lang) => void>();
let attached = false;

export function getLang(): Lang {
  return current;
}

/** Cache bijwerken en iedereen die hertekent waarschuwen. */
export function setLang(lang: Lang): void {
  if (lang === current) return;
  current = lang;
  for (const listener of [...listeners]) listener(lang);
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTS[current][key] ?? NL[key];
  return vars ? interpolate(template, vars) : template;
}

function uiLanguage(): string | null {
  try {
    return chrome.i18n?.getUILanguage?.() ?? null;
  } catch {
    return null; // geen chrome-API (test/onverwachte wereld)
  }
}

/**
 * De taal uit chrome.storage.local halen en cachen. Elke weergavelaag roept dit
 * één keer bij mount; faalt de opslag, dan blijft de NL-fallback staan in plaats
 * van dat het paneel niet opent.
 */
export async function ensureLang(): Promise<Lang> {
  try {
    const record = await chrome.storage.local.get(LANG_STORAGE_KEY);
    const stored = record[LANG_STORAGE_KEY];
    setLang(isLang(stored) ? stored : resolveLang(uiLanguage()));
  } catch {
    /* stil: fallback */
  }
  return current;
}

/** De keuze van de user bewaren; alle andere contexten horen het via onChanged. */
export async function saveLang(lang: Lang): Promise<void> {
  setLang(lang); // meteen, zodat de popup niet op de storage-ronde wacht
  try {
    await chrome.storage.local.set({ [LANG_STORAGE_KEY]: lang });
  } catch {
    /* stil: de keuze geldt dan alleen in dit venster */
  }
}

function attachStorageListener(): void {
  if (attached) return;
  attached = true;
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const change = changes[LANG_STORAGE_KEY];
      if (!change) return;
      setLang(isLang(change.newValue) ? change.newValue : resolveLang(uiLanguage()));
    });
  } catch {
    /* stil: zonder listener blijft de taal van deze context gewoon staan */
  }
}

/** Abonneren op een taalwissel (popup én paneel); geeft de opzegger terug. */
export function onLangChange(listener: (lang: Lang) => void): () => void {
  attachStorageListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
