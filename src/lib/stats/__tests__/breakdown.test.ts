import { describe, it, expect } from "vitest";
import { breakdownBy, breakdownByWithFaseSplit, breakdownByFaseKenmerk, computeRHistogram, computeCrossTable, getCell } from "../breakdown";
import { currenciesOfPair } from "../../constants";
import { makeTrade } from "./fixtures";

describe("breakdownBy", () => {
  it("single-key keyFn: counts and sums per fase match hand totals", () => {
    const trades = [
      makeTrade({ fase: "Fase 1", resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ fase: "Fase 1", resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ fase: "Fase 2", resultaat_pct: 3, outcome: "Win" }),
    ];
    const rows = breakdownBy(trades, (t) => t.fase, { minSample: 1 });
    const fase1 = rows.find((r) => r.key === "Fase 1")!;
    const fase2 = rows.find((r) => r.key === "Fase 2")!;
    expect(fase1).toMatchObject({ n: 2, resultaatTotal: 1, winRate: 0.5 });
    expect(fase2).toMatchObject({ n: 1, resultaatTotal: 3, winRate: 1 });
  });

  it("array-key keyFn: a pair counts toward both its currencies (intentional double counting)", () => {
    const trades = [makeTrade({ pair: "EURUSD" })];
    const rows = breakdownBy(trades, (t) => currenciesOfPair(t.pair), { minSample: 1 });
    const eur = rows.find((r) => r.key === "EUR");
    const usd = rows.find((r) => r.key === "USD");
    expect(eur?.n).toBe(1);
    expect(usd?.n).toBe(1);
  });

  it("null keyFn result excludes the trade from the breakdown", () => {
    const trades = [makeTrade({ trade_concept: null }), makeTrade({ trade_concept: "Reversal" })];
    const rows = breakdownBy(trades, (t) => t.trade_concept, { minSample: 1 });
    const total = rows.reduce((s, r) => s + r.n, 0);
    expect(total).toBe(1);
  });

  it("marks isLowSample true at n=14 and false at n=15 (rule: minder dan 15)", () => {
    const trades14 = Array.from({ length: 14 }, () => makeTrade({ pair: "EURUSD" }));
    const trades15 = Array.from({ length: 15 }, () => makeTrade({ pair: "EURUSD" }));
    expect(breakdownBy(trades14, (t) => t.pair)[0].isLowSample).toBe(true);
    expect(breakdownBy(trades15, (t) => t.pair)[0].isLowSample).toBe(false);
  });

  it("sortOrder overrides first-seen-in-data order (e.g. Fase 2 appearing before Fase 1 in the data)", () => {
    const trades = [
      makeTrade({ fase: "Fase 3" }),
      makeTrade({ fase: "Fase 1" }),
      makeTrade({ fase: "Fase 2" }),
      makeTrade({ fase: "Fase 4" }),
    ];
    const rows = breakdownBy(trades, (t) => t.fase, { minSample: 1, sortOrder: ["Fase 1", "Fase 2", "Fase 3", "Fase 4"] });
    expect(rows.map((r) => r.key)).toEqual(["Fase 1", "Fase 2", "Fase 3", "Fase 4"]);
  });

  it("sortOrder appends keys absent from the list after the ordered ones, in first-seen order", () => {
    const trades = [makeTrade({ pair: "GBPUSD" }), makeTrade({ pair: "EURUSD" }), makeTrade({ pair: "USDJPY" })];
    const rows = breakdownBy(trades, (t) => t.pair, { minSample: 1, sortOrder: ["EURUSD"] });
    expect(rows.map((r) => r.key)).toEqual(["EURUSD", "GBPUSD", "USDJPY"]);
  });
});

describe("breakdownByWithFaseSplit", () => {
  it("merges the overall breakdown with a per-fase split for the same key", () => {
    const trades = [
      makeTrade({ pair: "EURUSD", fase: "Fase 1", outcome: "Win", resultaat_pct: 1 }),
      makeTrade({ pair: "EURUSD", fase: "Fase 2", outcome: "Loss", resultaat_pct: -1 }),
    ];
    const rows = breakdownByWithFaseSplit(trades, (t) => t.pair, { minSample: 1 });
    const row = rows.find((r) => r.key === "EURUSD")!;
    expect(row.n).toBe(2);
    expect(row.byFase["Fase 1"]).toMatchObject({ n: 1, winRate: 1 });
    expect(row.byFase["Fase 2"]).toMatchObject({ n: 1, winRate: 0 });
    expect(row.byFase["Fase 3"]).toMatchObject({ n: 0 });
  });
});

describe("computeRHistogram", () => {
  it("bins each trade to the nearest whole R and keeps the empty bins in between", () => {
    // risk_pct null => 1% default => R equals resultaat_pct.
    const trades = [
      makeTrade({ resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ resultaat_pct: 2, outcome: "Win" }),
    ];
    const bins = computeRHistogram(trades);
    // Contiguous from -1R to +2R, with the empty 0R and +1R bins retained.
    expect(bins.map((b) => b.key)).toEqual(["-1R", "0R", "+1R", "+2R"]);
    expect(bins.map((b) => b.n)).toEqual([2, 0, 0, 3]);
    expect(bins.map((b) => b.bin)).toEqual([-1, 0, 1, 2]);
  });

  it("rounds to the nearest R (a -0.3R scratch lands in 0R, a 1.6R winner in +2R)", () => {
    const trades = [makeTrade({ resultaat_pct: -0.3 }), makeTrade({ resultaat_pct: 1.6 })];
    const bins = computeRHistogram(trades);
    expect(bins.map((b) => b.key)).toEqual(["0R", "+1R", "+2R"]);
    expect(bins.map((b) => b.n)).toEqual([1, 0, 1]);
  });

  it("uses explicit risk_pct so R differs from resultaat_pct", () => {
    // 2% result at 2% risk = 1R; 2% result at 1% risk = 2R.
    const trades = [makeTrade({ resultaat_pct: 2, risk_pct: 2 }), makeTrade({ resultaat_pct: 2, risk_pct: 1 })];
    const bins = computeRHistogram(trades);
    expect(bins.map((b) => b.key)).toEqual(["+1R", "+2R"]);
    expect(bins.map((b) => b.n)).toEqual([1, 1]);
  });

  it("folds extreme outliers into a ±cap overflow bin", () => {
    const bins = computeRHistogram([makeTrade({ resultaat_pct: 20 }), makeTrade({ resultaat_pct: 1 })]);
    const top = bins[bins.length - 1];
    expect(top.key).toBe("≥ 6R");
    expect(top.n).toBe(1);
  });

  it("returns [] for an empty list", () => {
    expect(computeRHistogram([])).toEqual([]);
  });
});

describe("computeCrossTable", () => {
  it("places trades in the (row, col) cell and reconciles cells with row/col/grand totals (single-key dims)", () => {
    const trades = [
      makeTrade({ trade_concept: "A", sessie: "London", resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ trade_concept: "A", sessie: "London", resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ trade_concept: "A", sessie: "Asia", resultaat_pct: 3, outcome: "Win" }),
      makeTrade({ trade_concept: "B", sessie: "London", resultaat_pct: 1, outcome: "Win" }),
    ];
    const table = computeCrossTable(trades, (t) => t.trade_concept, (t) => t.sessie, { minSample: 1 });
    expect(table.rowKeys).toEqual(["A", "B"]);
    expect(getCell(table, "A", "London")).toMatchObject({ n: 2, resultaatTotal: 1, winRate: 0.5 });
    expect(getCell(table, "A", "Asia")).toMatchObject({ n: 1, resultaatTotal: 3 });
    expect(getCell(table, "B", "Asia")).toBeNull();
    expect(table.rowTotals.get("A")).toMatchObject({ n: 3, resultaatTotal: 4 });
    expect(table.colTotals.get("London")).toMatchObject({ n: 3, resultaatTotal: 2 });
    expect(table.grandTotal).toMatchObject({ n: 4, resultaatTotal: 5 });
  });

  it("drops a trade from the whole table when either axis key is null", () => {
    const trades = [
      makeTrade({ trade_concept: "A", direction: "Long" }),
      makeTrade({ trade_concept: null, direction: "Long" }), // no row key
      makeTrade({ trade_concept: "A", direction: null }), // no col key
    ];
    const table = computeCrossTable(trades, (t) => t.trade_concept, (t) => t.direction, { minSample: 1 });
    expect(table.grandTotal.n).toBe(1);
    expect(getCell(table, "A", "Long")).toMatchObject({ n: 1 });
  });

  it("spreads an array-key (currency) trade across each combination but counts it once in grand total", () => {
    const trades = [makeTrade({ pair: "EURUSD", direction: "Long" })];
    const table = computeCrossTable(trades, (t) => currenciesOfPair(t.pair), (t) => t.direction, { minSample: 1 });
    expect(table.rowKeys).toEqual(["EUR", "USD"]);
    expect(getCell(table, "EUR", "Long")?.n).toBe(1);
    expect(getCell(table, "USD", "Long")?.n).toBe(1);
    // Grand total counts the single trade once, even though it lands in two rows.
    expect(table.grandTotal.n).toBe(1);
  });

  it("honours row/col sortOrder", () => {
    const trades = [
      makeTrade({ trade_concept: "A", sessie: "New York" }),
      makeTrade({ trade_concept: "A", sessie: "Asia" }),
    ];
    const table = computeCrossTable(trades, (t) => t.trade_concept, (t) => t.sessie, {
      colOrder: ["Asia", "London", "Overlap", "New York"],
      minSample: 1,
    });
    expect(table.colKeys).toEqual(["Asia", "New York"]);
  });
});

describe("breakdownByFaseKenmerk", () => {
  it("scopes to the config's fase and maps booleans to Ja/Nee", () => {
    const trades = [
      makeTrade({ fase: "Fase 1", fase1_daily_respecteert_zone: true, outcome: "Win" }),
      makeTrade({ fase: "Fase 1", fase1_daily_respecteert_zone: false, outcome: "Loss" }),
      makeTrade({ fase: "Fase 2", fase1_daily_respecteert_zone: true, outcome: "Win" }), // wrong fase, excluded
    ];
    const rows = breakdownByFaseKenmerk(
      trades,
      { fase: "Fase 1", field: "fase1_daily_respecteert_zone", values: "boolean" },
      { minSample: 1 }
    );
    expect(rows.reduce((s, r) => s + r.n, 0)).toBe(2);
    expect(rows.find((r) => r.key === "Ja")?.n).toBe(1);
    expect(rows.find((r) => r.key === "Nee")?.n).toBe(1);
  });
});
