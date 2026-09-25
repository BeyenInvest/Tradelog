import { describe, expect, it } from "vitest";
import type { ChartState, PositionState } from "../../adapter/parse";
import { chartStateStale } from "./staleness";

function pos(overrides: Partial<PositionState> = {}): PositionState {
  return {
    id: "WJJ3zr",
    direction: "Long",
    entry: 110.33,
    entryTimeSec: 1789448400,
    endTimeSec: 1789621200,
    stopLevelTicks: 500,
    profitLevelTicks: 1000,
    prices: null,
    ...overrides,
  };
}

function state(overrides: Partial<ChartState> = {}): ChartState {
  return {
    symbol: { ok: true, value: "OANDA:AUDJPY" },
    resolution: { ok: true, value: "240" },
    tick: { ok: true, value: { size: 0.001, source: "formatter-props" } },
    positions: { ok: true, value: [pos()] },
    dropped: [],
    lastBar: { ok: true, value: { timeSec: 1789678800, close: 110.904, inReplay: false } },
    ...overrides,
  };
}

describe("chartStateStale — D1-staleness-guard van submit()", () => {
  it("ongewijzigde chart = niet stale (ook al veranderde de laatste bar)", () => {
    const fresh = state({ lastBar: { ok: true, value: { timeSec: 1789765200, close: 111.2, inReplay: false } } });
    expect(chartStateStale(state(), fresh, null)).toBe(false);
  });

  it("zonder getoonde staat valt er niets te verouderen", () => {
    expect(chartStateStale(null, state(), null)).toBe(false);
  });

  it("symboolwissel is stale — ook als de tool identiek oogt", () => {
    const fresh = state({ symbol: { ok: true, value: "OANDA:EURUSD" } });
    expect(chartStateStale(state(), fresh, null)).toBe(true);
  });

  it("een symbool dat niet meer leesbaar is telt als stale (niet te bevestigen)", () => {
    const fresh = state({ symbol: { ok: false, reason: "symbol: lezen faalde" } });
    expect(chartStateStale(state(), fresh, null)).toBe(true);
  });

  it("verwijderde/vervangen tool is stale", () => {
    expect(chartStateStale(state(), state({ positions: { ok: true, value: [] } }), null)).toBe(true);
    const swapped = state({ positions: { ok: true, value: [pos({ id: "ander" })] } });
    expect(chartStateStale(state(), swapped, null)).toBe(true);
  });

  it("versleepte tool (prijs, ticks of tijd) is stale", () => {
    for (const change of [
      { entry: 111.0 },
      { stopLevelTicks: 250 },
      { profitLevelTicks: 750 },
      { direction: "Short" as const },
      { entryTimeSec: 1789534800 },
      { endTimeSec: null },
    ]) {
      const fresh = state({ positions: { ok: true, value: [pos(change)] } });
      expect(chartStateStale(state(), fresh, null)).toBe(true);
    }
  });

  it("vergelijkt de GESELECTEERDE tool, niet de eerste", () => {
    const shown = state({ positions: { ok: true, value: [pos(), pos({ id: "tweede", entry: 108 })] } });
    // De eerste tool veranderde, maar de selectie ("tweede") niet.
    const fresh = state({ positions: { ok: true, value: [pos({ entry: 999 }), pos({ id: "tweede", entry: 108 })] } });
    expect(chartStateStale(shown, fresh, "tweede")).toBe(false);
    expect(chartStateStale(shown, fresh, null)).toBe(true); // fallback = eerste
  });

  it("paneel zonder tool (handmatige invoer) blokkeert niet op tool-wijzigingen", () => {
    const shown = state({ positions: { ok: true, value: [] } });
    const fresh = state(); // er kwam een tool bíj — geen reden om te blokkeren
    expect(chartStateStale(shown, fresh, null)).toBe(false);
  });

  it("positions die eerst leesbaar waren en nu niet = stale", () => {
    const fresh = state({ positions: { ok: false, reason: "shapes: lezen faalde" } });
    expect(chartStateStale(state(), fresh, null)).toBe(true);
  });
});
