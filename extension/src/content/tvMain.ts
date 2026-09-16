// MAIN-world content script (F2a) — de enige plek die window.TradingViewApi
// aanraakt. Leest de chart-state (S0-bewezen API-vorm, docs/spike-tv-extensie.md)
// en zet op verzoek de resolution (snapshot-cyclus, F3a). Schrijft verder NIETS
// naar TV. Gebundeld als IIFE (content scripts zijn classic scripts, geen ESM).
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
  };
}

function setResolution(resolution: string): unknown {
  const w = window as unknown as { TradingViewApi?: { activeChart?: () => { setResolution?: (r: string) => void } } };
  return safe(() => {
    const c = w.TradingViewApi?.activeChart?.();
    if (!c?.setResolution) throw new Error("setResolution niet beschikbaar");
    c.setResolution(resolution);
    return true;
  });
}

function run(command: PageCommand): unknown {
  switch (command.cmd) {
    case "read-state":
      return readState();
    case "set-resolution":
      return setResolution(command.resolution);
  }
}

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const data: unknown = ev.data;
  if (!isPageRequest(data)) return;
  let payload: unknown;
  try {
    payload = run(data.command);
  } catch (e) {
    payload = { fatal: String((e instanceof Error && e.message) || e) };
  }
  window.postMessage(makeResponse(data.id, payload), location.origin);
});
