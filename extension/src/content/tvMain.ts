// MAIN-world content script (F2a) — de enige plek die window.TradingViewApi
// aanraakt. Leest de chart-state (S0-bewezen API-vorm, docs/spike-tv-extensie.md)
// en zet op verzoek de resolution (snapshot-cyclus, F3a). Schrijft verder NIETS
// naar TV. Gebundeld als IIFE (content scripts zijn classic scripts, geen ESM).
import {
  GRACE_MS, normalizeResolution, READY_TIMEOUT_MS, waitForChartReady,
  type BarProbe, type ReadyProbe, type WaitReadyOutcome,
} from "../adapter/chartReady";
import { isPageRequest, makeResponse, type PageCommand } from "../adapter/protocol";

interface SafeResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

function safe(fn: () => unknown): SafeResult {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: String((e instanceof Error && e.message) || e) };
  }
}

// Beperkte serialisatie: shapes/properties kunnen groot zijn en cycles bevatten.
function ser(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "function") return "[Function]";
  if (t === "string") return (value as string).length > 500 ? (value as string).slice(0, 500) : value;
  if (t === "number" || t === "boolean") return value;
  if (depth >= 4) return "[depth]";
  if (t === "object") {
    const obj = value as object;
    if (seen.has(obj)) return "[cycle]";
    seen.add(obj);
    if (Array.isArray(obj)) return obj.slice(0, 30).map((v) => ser(v, depth + 1, seen));
    const out: Record<string, unknown> = {};
    let n = 0;
    for (const k in obj) {
      if (n++ >= 50) break;
      try {
        out[k] = ser((obj as Record<string, unknown>)[k], depth + 1, seen);
      } catch (e) {
        out[k] = "[getter threw]";
      }
    }
    return out;
  }
  return String(value);
}

/** Rauwe snapshot — parse.ts (extensie-kant) maakt hier pas typed data van. */
function readState(): unknown {
  const w = window as unknown as Record<string, unknown>;
  const api = w.TradingViewApi as Record<string, unknown> | undefined;
  if (!api || typeof api !== "object") {
    return { apiPresent: false };
  }
  const a = api as {
    activeChart?: () => {
      symbol?: () => unknown;
      resolution?: () => unknown;
      symbolExt?: () => unknown;
      priceFormatter?: () => unknown;
      getAllShapes?: () => Array<{ id: unknown; name: unknown }>;
      getShapeById?: (id: unknown) => { getPoints?: () => unknown; getProperties?: () => unknown };
      getSeries?: () => {
        data?: () => { bars?: () => { last?: () => unknown } };
        isInReplay?: () => { value?: () => unknown };
      };
    };
  };

  const chartR = safe(() => {
    const c = a.activeChart?.();
    if (!c) throw new Error("activeChart() gaf niets");
    return c;
  });
  if (!chartR.ok) return { apiPresent: true, chart: chartR };
  const chart = chartR.value as NonNullable<ReturnType<NonNullable<typeof a.activeChart>>>;

  const shapes = safe(() => {
    const list = chart.getAllShapes?.() ?? [];
    return list.slice(0, 30).map((s) => {
      const name = typeof s.name === "string" ? s.name : String(s.name);
      const entry: Record<string, unknown> = { id: ser(s.id), name };
      // Alleen de position-tools volledig uitlezen — de rest is ruis.
      if (name === "long_position" || name === "short_position") {
        const shape = safe(() => chart.getShapeById?.(s.id));
        if (shape.ok && shape.value) {
          const sh = shape.value as { getPoints?: () => unknown; getProperties?: () => unknown };
          entry.points = safe(() => ser(sh.getPoints?.()));
          entry.properties = safe(() => ser(sh.getProperties?.()));
        } else {
          entry.shapeError = shape.error ?? "getShapeById faalde";
        }
      }
      return entry;
    });
  });

  return {
    apiPresent: true,
    href: location.href,
    symbol: safe(() => chart.symbol?.()),
    resolution: safe(() => chart.resolution?.()),
    symbolExt: safe(() => ser(chart.symbolExt?.())),
    formatter: safe(() => ser(chart.priceFormatter?.())),
    formattedSample: safe(() => {
      const f = chart.priceFormatter?.() as { format?: (n: number) => unknown } | undefined;
      return f?.format?.(1.2345678);
    }),
    shapes,
    // F5 (S1-bewezen): laatste bar van de hoofdserie — [timeSec, o, h, l, c, ...]
    // — voor exit-prefill + replay-veilige sluitdatum. getSeries().data().bars()
    // is intern-vormig (zelfde risicoprofiel als de formatter-props): elke
    // TV-drift degradeert hier naar een safe-fout, het paneel valt dan terug op
    // handmatige invoer.
    lastBar: safe(() => {
      const s = chart.getSeries?.();
      if (!s) throw new Error("getSeries() niet beschikbaar");
      const last = s.data?.()?.bars?.()?.last?.();
      if (!last) throw new Error("geen laatste bar");
      const inReplay = safe(() => s.isInReplay?.()?.value?.());
      return { last: ser(last), inReplay: inReplay.ok ? ser(inReplay.value) : null };
    }),
  };
}

/** F3a-fix: TV's eigen client-side screenshot (chart-only canvas) — geen
 * activeTab-gebaar en geen crop nodig. Elke afwijking van het verwachte
 * canvas-contract is een nette fout; de SW valt dan terug op captureVisibleTab. */
async function takeScreenshot(): Promise<unknown> {
  const w = window as unknown as { TradingViewApi?: { takeClientScreenshot?: () => unknown } };
  try {
    const api = w.TradingViewApi;
    if (!api?.takeClientScreenshot) return { ok: false, error: "takeClientScreenshot niet beschikbaar" };
    const canvas = await Promise.resolve(api.takeClientScreenshot());
    if (!(canvas instanceof HTMLCanvasElement)) return { ok: false, error: "geen canvas teruggekregen" };
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png")) return { ok: false, error: "toDataURL gaf geen PNG" };
    return { ok: true, dataUrl, width: canvas.width, height: canvas.height };
  } catch (e) {
    return { ok: false, error: String((e instanceof Error && e.message) || e) };
  }
}

/** Gearmde onDataLoaded-subscription rond één programmatische switch. TV's
 * `dataReady()` kan vlak na een switch liegen (true op de oude serie) en de
 * resolution flipt synchroon — het event is het enige signaal dat écht "nieuwe
 * data staat er" betekent (runtime bewezen, ook bij gecachete switches). Vóór
 * de set subscriben, dus geen gemist event bij snelle loads. */
interface DataLoadedSub {
  subscribe?: (obj: unknown, cb: () => void, once?: boolean) => void;
  unsubscribe?: (obj: unknown, cb: () => void) => void;
}
interface PendingLoad {
  target: string;
  fired: boolean;
  cb: () => void;
  sub: DataLoadedSub | null;
}
let pendingLoad: PendingLoad | null = null;

function armDataLoaded(target: string): void {
  // Oude, nooit-gevuurde subscription loskoppelen zodat die niet de nieuwe
  // vlag zet (singleshot ruimt zichzelf alleen op ná vuren).
  if (pendingLoad && !pendingLoad.fired) {
    try { pendingLoad.sub?.unsubscribe?.(null, pendingLoad.cb); } catch { /* al weg */ }
  }
  const state: PendingLoad = { target, fired: false, cb: () => { state.fired = true; }, sub: null };
  try {
    const w = window as unknown as {
      TradingViewApi?: { activeChart?: () => { onDataLoaded?: () => DataLoadedSub } };
    };
    const sub = w.TradingViewApi?.activeChart?.()?.onDataLoaded?.();
    if (sub && typeof sub.subscribe === "function") {
      sub.subscribe(null, state.cb, true);
      state.sub = sub;
    }
  } catch { /* geen event beschikbaar → de poll-fallback vangt dit op */ }
  // Alleen armen als de subscription écht hangt — anders zou het settle-pad 5 s
  // blind wachten op een event dat nooit komt (TV-drift), terwijl de
  // waitForChartReady-poll dat geval juist netjes afdekt.
  pendingLoad = state.sub ? state : null;
}

function setResolution(resolution: string): unknown {
  const w = window as unknown as { TradingViewApi?: { activeChart?: () => { setResolution?: (r: string) => void } } };
  return safe(() => {
    const c = w.TradingViewApi?.activeChart?.();
    if (!c?.setResolution) throw new Error("setResolution niet beschikbaar");
    armDataLoaded(resolution);
    c.setResolution(resolution);
    return true;
  });
}

/** Lezers voor de snapshot-settle (chartReady.ts) — zelfde defensieve stijl als
 * readState: elke TV-drift degradeert naar null/unreadable, nooit een throw. */
function makeReadyProbe(): ReadyProbe {
  const w = window as unknown as {
    TradingViewApi?: {
      activeChart?: () => {
        resolution?: () => unknown;
        dataReady?: (cb?: () => void) => unknown;
        loadingScreenActive?: () => unknown;
        getSeries?: () => {
          data?: () => { bars?: () => { last?: () => unknown } };
          isLoading?: () => unknown;
        };
      };
    };
  };
  const chart = () => w.TradingViewApi?.activeChart?.();
  return {
    resolution() {
      try {
        const r = chart()?.resolution?.();
        return typeof r === "string" ? r : null;
      } catch {
        return null;
      }
    },
    dataReady() {
      try {
        const c = chart();
        if (typeof c?.dataReady !== "function") return null;
        const v = c.dataReady(() => {});
        return typeof v === "boolean" ? v : null;
      } catch {
        return null;
      }
    },
    lastBar(): BarProbe {
      try {
        const bars = chart()?.getSeries?.()?.data?.()?.bars?.();
        if (!bars || typeof bars.last !== "function") return { kind: "unreadable" };
        const last = bars.last();
        if (!last) return { kind: "empty" };
        // TV-drift 2026-09: last() geeft { index, value: [timeSec, o, h, l, c, ...] }
        // i.p.v. de kale array (zelfde shape als parse.ts al afhandelt).
        const v = Array.isArray(last) ? last : (last as { value?: unknown }).value;
        const t = Array.isArray(v) ? (v as unknown[])[0] : null;
        return { kind: "bar", time: typeof t === "number" ? t : null };
      } catch {
        return { kind: "unreadable" };
      }
    },
    busy() {
      // isLoading() is (anders dan dataReady) een éérlijk signaal: true vanaf
      // vlak na de switch tot álles klaar is, inclusief de "No gaps candles
      // loading…"-narekening die het lege-Daily-beeld veroorzaakte. Het
      // loading-screen dekt hetzelfde vanaf de chart-kant. Alleen een expliciet
      // gelezen boolean telt; drift ⇒ null.
      let known = false;
      try {
        const l = chart()?.getSeries?.()?.isLoading?.();
        if (l === true) return true;
        if (l === false) known = true;
      } catch { /* onleesbaar */ }
      try {
        const ls = chart()?.loadingScreenActive?.();
        if (ls === true) return true;
        if (ls === false) known = true;
      } catch { /* onleesbaar */ }
      return known ? false : null;
    },
  };
}

/** Snapshot-settle: wachten tot de chart het gevraagde timeframe echt geladen
 * én getekend heeft. Primair = het gearmde onDataLoaded-event van de eigen
 * setResolution (snel én waarheidsgetrouw); zonder gearmd event (settle zonder
 * switch, TV-drift) valt hij terug op de poll in chartReady.ts. Rejects nooit —
 * bij timeout meldt hij dat en captured de cyclus alsnog. */
async function waitChartReady(resolution: string): Promise<unknown> {
  let outcome: WaitReadyOutcome;
  const pend = pendingLoad;
  if (pend && normalizeResolution(pend.target) === normalizeResolution(resolution)) {
    pendingLoad = null; // verbruikt — één settle per gearmde switch
    const probe = makeReadyProbe();
    const start = Date.now();
    while (!pend.fired && Date.now() - start < READY_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!pend.fired) {
      try { pend.sub?.unsubscribe?.(null, pend.cb); } catch { /* al weg */ }
    }
    // Het event zegt "nieuwe data is binnen", maar TV kan daarná nog narekenen
    // ("No gaps candles loading…" gaf zo alsnog een leeg beeld) — dus óók
    // wachten tot de serie zelf niet meer bezig is, binnen hetzelfde budget.
    while (pend.fired && probe.busy() === true && Date.now() - start < READY_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const waitedMs = Date.now() - start;
    const ready = pend.fired && probe.busy() !== true;
    outcome = ready
      ? { ready: true, signal: "data-loaded", waitedMs, polls: 0 }
      : { ready: false, signal: "timeout", waitedMs, polls: 0 };
  } else {
    outcome = await waitForChartReady(makeReadyProbe(), resolution);
  }
  // Data geladen ≠ frame getekend: twee frames afwachten vóór de capture. De
  // setTimeout-race voorkomt hangen wanneer rAF niet vuurt (verborgen tab).
  const frame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
      setTimeout(resolve, 250);
    });
  await frame();
  await frame();
  // Alleen als er echt gewacht is nog een korte grace — geeft trage studies
  // ("… loading") lucht zonder de vlotte slots te vertragen.
  if (outcome.ready && (outcome.polls > 1 || outcome.waitedMs > 0)) {
    await new Promise((resolve) => setTimeout(resolve, GRACE_MS));
  }
  return { ok: true, ...outcome };
}

function run(command: PageCommand): unknown | Promise<unknown> {
  switch (command.cmd) {
    case "read-state":
      return readState();
    case "set-resolution":
      return setResolution(command.resolution);
    case "wait-chart-ready":
      return waitChartReady(command.resolution);
    case "take-screenshot":
      return takeScreenshot();
  }
}

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const data: unknown = ev.data;
  if (!isPageRequest(data)) return;
  // take-screenshot is async — via Promise.resolve loopt sync en async door
  // hetzelfde antwoordpad (de bridge heeft toch een eigen timeout).
  Promise.resolve()
    .then(() => run(data.command))
    .catch((e: unknown) => ({ fatal: String((e instanceof Error && e.message) || e) }))
    .then((payload) => window.postMessage(makeResponse(data.id, payload), location.origin));
});
