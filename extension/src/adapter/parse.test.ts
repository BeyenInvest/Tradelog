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
    // F5/S1-opname (17-09): getSeries().data().bars().last() — [timeSec, o, h, l, c, volume].
    lastBar: {
      ok: true,
      value: {
        last: { index: 299, value: [1789678800, 110.997, 110.997, 110.882, 110.904, 1244] },
        inReplay: false,
      },
    },
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
    expect(pos.endTimeSec).toBe(1789621200); // punt 2 = rechterrand van de box
    expect(pos.prices?.stop).toBeCloseTo(109.83, 10);
    expect(pos.prices?.target).toBeCloseTo(111.33, 10);
    expect(pos.prices?.plannedRR).toBe(2);
  });

  it("negeert een eindpunt dat niet ná de entry ligt (ingeklapte/omgekeerde box)", () => {
    const raw = s0Fixture();
    const shape = (raw.shapes as { value: Array<Record<string, unknown>> }).value[1];
    (shape.points as { value: Array<{ price: number; time: number }> }).value[1].time = 1789448400;
    const state = parseChartState(raw);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    expect(state.positions.value[0].endTimeSec).toBeNull();
  });

  it("valt terug op symbolExt.minmov/pricescale als de formatter-props wegvallen (D5)", () => {
    const raw = s0Fixture();
    raw.formatter = { ok: false, value: undefined } as never;
    (raw.symbolExt.value as Record<string, unknown>).minmov = 1;
    (raw.symbolExt.value as Record<string, unknown>).pricescale = 1000;
    const state = parseChartState(raw);
    expect(state.tick).toEqual({ ok: true, value: { size: 0.001, source: "symbol-ext" } });
  });

  it("symbolExt-bron overleeft ook fractie-ticks waar de sample-teller op faalt (D5)", () => {
    const raw = s0Fixture();
    raw.formatter = { ok: false, value: undefined } as never;
    raw.formattedSample = { ok: true, value: "110'16" }; // fractie-notatie
    (raw.symbolExt.value as Record<string, unknown>).minmov = 1;
    (raw.symbolExt.value as Record<string, unknown>).pricescale = 4;
    const state = parseChartState(raw);
    expect(state.tick).toEqual({ ok: true, value: { size: 0.25, source: "symbol-ext" } });
  });

  it("valt terug op decimalen tellen als formatter-props én symbolExt wegvallen (TV-drift)", () => {
    const raw = s0Fixture();
    raw.formatter = { ok: false, value: undefined } as never;
    const state = parseChartState(raw); // fixture-symbolExt draagt geen minmov/pricescale
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

  it("parseert de laatste bar (exit-prefill + replay-vlag, F5)", () => {
    const state = parseChartState(s0Fixture());
    expect(state.lastBar).toEqual({ ok: true, value: { timeSec: 1789678800, close: 110.904, inReplay: false } });

    const replay = s0Fixture();
    (replay.lastBar.value as { inReplay: unknown }).inReplay = true;
    const replayState = parseChartState(replay);
    if (!replayState.lastBar.ok) throw new Error("lastBar hoort ok te zijn");
    expect(replayState.lastBar.value.inReplay).toBe(true);
  });

  it("degradeert de laatste bar los van de rest (TV-drift → handmatige exit)", () => {
    const raw = s0Fixture();
    (raw as Record<string, unknown>).lastBar = { ok: false, error: "getSeries() niet beschikbaar" };
    const state = parseChartState(raw);
    expect(state.lastBar.ok).toBe(false);
    expect(state.symbol.ok).toBe(true); // de rest blijft bruikbaar

    const short = s0Fixture();
    (short.lastBar.value.last as { value: unknown }).value = [1789678800, 110.997]; // te korte bar-array
    expect(parseChartState(short).lastBar.ok).toBe(false);

    const zero = s0Fixture();
    (zero.lastBar.value.last as { value: unknown }).value = [1789678800, 1, 1, 1, 0]; // close ≤ 0
    expect(parseChartState(zero).lastBar.ok).toBe(false);
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
    for (const r of [state.symbol, state.resolution, state.tick, state.positions, state.lastBar]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("TradingViewApi");
    }
  });

  it("bridge-timeout en rommel-payloads degraderen netjes", () => {
    expect(parseChartState({ bridgeTimeout: true }).symbol.ok).toBe(false);
    expect(parseChartState(null).symbol.ok).toBe(false);
    expect(parseChartState("garbage").symbol.ok).toBe(false);
  });

  it("kapotte shape-entries worden overgeslagen én gemeld als dropped (D4)", () => {
    const raw = s0Fixture();
    (raw.shapes.value[1] as Record<string, unknown>).properties = { ok: true, value: { stopLevel: "vijfhonderd" } };
    const state = parseChartState(raw);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    expect(state.positions.value).toHaveLength(0);
    expect(state.dropped).toEqual([{ id: "WJJ3zr", reason: "stopLevel/profitLevel onleesbaar" }]);
  });

  it("shapeError uit de page-world (getShapeById faalde) wordt dropped met die reden (D4)", () => {
    const raw = s0Fixture();
    const shape = raw.shapes.value[1] as Record<string, unknown>;
    delete shape.points;
    delete shape.properties;
    shape.shapeError = "getShapeById faalde";
    const state = parseChartState(raw);
    if (!state.positions.ok) throw new Error("positions hoort ok te zijn");
    expect(state.positions.value).toHaveLength(0);
    expect(state.dropped).toEqual([{ id: "WJJ3zr", reason: "getShapeById faalde" }]);
  });

  it("niet-position-shapes tellen nooit als dropped; een gave chart heeft dropped=[]", () => {
    const state = parseChartState(s0Fixture()); // horizontal_ray in de fixture = ruis
    expect(state.dropped).toEqual([]);
  });
});
