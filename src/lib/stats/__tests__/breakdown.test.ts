import { describe, it, expect } from "vitest";
import { breakdownBy, breakdownByWithFaseSplit, breakdownByFaseKenmerk } from "../breakdown";
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
