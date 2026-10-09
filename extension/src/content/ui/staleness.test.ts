import { describe, expect, it } from "vitest";
import type { ChartState, PositionState } from "../../adapter/parse";
import { chartStateStale, pickPosition, positionsNewestFirst } from "./staleness";

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

  it("vergelijkt de GESELECTEERDE tool, niet een andere", () => {
    const shown = state({ positions: { ok: true, value: [pos(), pos({ id: "tweede", entry: 108 })] } });
    // De eerste tool veranderde, maar de selectie ("tweede") niet.
    const fresh = state({ positions: { ok: true, value: [pos({ entry: 999 }), pos({ id: "tweede", entry: 108 })] } });
    expect(chartStateStale(shown, fresh, "tweede")).toBe(false);
    expect(chartStateStale(shown, fresh, "WJJ3zr")).toBe(true);
    // Zonder keuze = de nieuwste (gelijke tijd → laatste in de lijst = "tweede").
    expect(chartStateStale(shown, fresh, null)).toBe(false);
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

describe("positionsNewestFirst / pickPosition — default = de laatste tool", () => {
  const oud = pos({ id: "oud", entryTimeSec: 1789000000 });
  const nieuw = pos({ id: "nieuw", entryTimeSec: 1789900000 });
  const midden = pos({ id: "midden", entryTimeSec: 1789500000 });

  it("sorteert op entry-tijd, nieuwste eerst — ongeacht TV's lijstvolgorde", () => {
    expect(positionsNewestFirst([oud, nieuw, midden]).map((p) => p.id)).toEqual(["nieuw", "midden", "oud"]);
    expect(positionsNewestFirst([nieuw, oud]).map((p) => p.id)).toEqual(["nieuw", "oud"]);
  });

  it("gelijke tijd → later in de lijst eerst; zonder tijd achteraan", () => {
    const a = pos({ id: "a" });
    const b = pos({ id: "b" });
    const zonder = pos({ id: "zonder", entryTimeSec: null });
    expect(positionsNewestFirst([a, b]).map((p) => p.id)).toEqual(["b", "a"]);
    expect(positionsNewestFirst([zonder, oud]).map((p) => p.id)).toEqual(["oud", "zonder"]);
    expect(positionsNewestFirst([pos({ id: "x", entryTimeSec: null }), zonder]).map((p) => p.id)).toEqual(["zonder", "x"]);
  });

  it("zonder keuze de nieuwste; een expliciete keuze wint; een verdwenen keuze valt terug", () => {
    expect(pickPosition([oud, nieuw, midden], null)?.id).toBe("nieuw");
    expect(pickPosition([oud, nieuw, midden], "oud")?.id).toBe("oud");
    expect(pickPosition([oud, midden], "nieuw")?.id).toBe("midden");
    expect(pickPosition([], null)).toBeNull();
  });
});
