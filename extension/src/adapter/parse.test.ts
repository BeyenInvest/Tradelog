import { describe, expect, it } from "vitest";
import { parseChartState } from "./parse";

// Fixture = het owner-proberapport uit de S0-spike (docs/spike-tv-extensie.md),
// in exact de vorm die content/tvMain.ts produceert. Dit is het contract met
// TV's page-world-API — verandert TV z'n vorm, dan hoort déze test de nieuwe
// opgenomen fixture te krijgen.
function s0Fixture() {
  return {
    apiPresent: true,
    href: "https://www.tradingview.com/chart/MshnPeEI/",
    symbol: { ok: true, value: "OANDA:AUDJPY" },
    resolution: { ok: true, value: "240" },
    symbolExt: { ok: true, value: { symbol: "AUDJPY", type: "forex" } },
    formatter: {
      ok: true,
      value: { type: "price", _priceScale: 1000, _minMove: 1, _minMove2: 10, _fractional: false, _fractionalLength: 3 },
    },
    formattedSample: { ok: true, value: "1.235" },
    shapes: {
      ok: true,
      value: [
        {
          id: "2IhTTb",
          name: "horizontal_ray",
        },
        {
          id: "WJJ3zr",
          name: "long_position",
          points: {
            ok: true,
            value: [
              { price: 110.33, time: 1789448400 },
              { price: 110.33, time: 1789621200 },
            ],
          },
          properties: {
            ok: true,
            value: { stopLevel: 500, profitLevel: 1000, qty: 500, accountSize: 1000, risk: 25 },
          },
        },
      ],
    },
  };
}

describe("parseChartState — S0-contractfixture", () => {
  it("parseert symbol, resolution en tick uit de formatter-props", () => {
    const state = parseChartState(s0Fixture());
    expect(state.symbol).toEqual({ ok: true, value: "OANDA:AUDJPY" });
    expect(state.resolution).toEqual({ ok: true, value: "240" });
    expect(state.tick).toEqual({ ok: true, value: { size: 0.001, source: "formatter-props" } });
  });

  it("vertaalt de long_position naar richting + absolute prijzen + R:R", () => {
    const state = parseChartState(s0Fixture());
    expect(state.positions.ok).toBe(true);
    if (!state.positions.ok) return;
    expect(state.positions.value).toHaveLength(1); // horizontal_ray is genegeerd
    const pos = state.positions.value[0];
    expect(pos.direction).toBe("Long");
    expect(pos.entry).toBe(110.33);
    expect(pos.entryTimeSec).toBe(1789448400);
    expect(pos.prices?.stop).toBeCloseTo(109.83, 10);
    expect(pos.prices?.target).toBeCloseTo(111.33, 10);
    expect(pos.prices?.plannedRR).toBe(2);
  });

  it("valt terug op decimalen tellen als de formatter-props wegvallen (TV-drift)", () => {
    const raw = s0Fixture();
    raw.formatter = { ok: false, value: undefined } as never;
    const state = parseChartState(raw);
    expect(state.tick).toEqual({ ok: true, value: { size: 0.001, source: "formatted-sample" } });
  });

  it("degradeert tick + prijzen expliciet bij een fractie-notatie (nooit gokken)", () => {
    const raw = s0Fixture();
    raw.formatter = { ok: false, value: undefined } as never;
    raw.formattedSample = { ok: true, value: "110'16" };
    const state = parseChartState(raw);
    expect(state.tick.ok).toBe(false);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    expect(state.positions.value[0].prices).toBeNull(); // ticks wel, prijzen niet
    expect(state.positions.value[0].stopLevelTicks).toBe(500);
  });

  it("short_position spiegelt de prijzen", () => {
    const raw = s0Fixture();
    (raw.shapes.value[1] as { name: string }).name = "short_position";
    const state = parseChartState(raw);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    const pos = state.positions.value[0];
    expect(pos.direction).toBe("Short");
    expect(pos.prices?.stop).toBeCloseTo(110.83, 10);
    expect(pos.prices?.target).toBeCloseTo(109.33, 10);
  });
});

describe("parseChartState — degradatie over de hele linie", () => {
  it("alles faalt met één duidelijke reden zonder TradingViewApi", () => {
    const state = parseChartState({ apiPresent: false });
    for (const r of [state.symbol, state.resolution, state.tick, state.positions]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("TradingViewApi");
    }
  });

  it("bridge-timeout en rommel-payloads degraderen netjes", () => {
    expect(parseChartState({ bridgeTimeout: true }).symbol.ok).toBe(false);
    expect(parseChartState(null).symbol.ok).toBe(false);
    expect(parseChartState("garbage").symbol.ok).toBe(false);
  });

  it("kapotte shape-entries worden overgeslagen, niet half geparseerd", () => {
    const raw = s0Fixture();
    (raw.shapes.value[1] as Record<string, unknown>).properties = { ok: true, value: { stopLevel: "vijfhonderd" } };
    const state = parseChartState(raw);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    expect(state.positions.value).toHaveLength(0);
  });
});
