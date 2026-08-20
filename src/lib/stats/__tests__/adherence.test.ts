import { describe, expect, it } from "vitest";
import { computeConditionGaps, computeEvaluationImpact } from "../adherence";
import { makeTrade } from "./fixtures";

describe("computeEvaluationImpact", () => {
  it("returns empty buckets and null gaps with no trades", () => {
    const impact = computeEvaluationImpact([]);
    expect(impact.graded).toBe(0);
    expect(impact.errorN).toBe(0);
    expect(impact.goodAvgR).toBeNull();
    expect(impact.errorAvgR).toBeNull();
    expect(impact.avgRGap).toBeNull();
    expect(impact.estimatedCostR).toBeNull();
    expect(impact.buckets.map((b) => b.evaluation)).toEqual(["Good trade", "Emotional error", "Technical error"]);
    expect(impact.buckets.every((b) => b.n === 0 && b.avgR === null)).toBe(true);
  });

  it("buckets graded trades and ignores ungraded and missed ones", () => {
    const impact = computeEvaluationImpact([
      makeTrade({ trade_evaluation: "Good trade", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ trade_evaluation: "Good trade", outcome: "Loss", resultaat_pct: -1 }),
      makeTrade({ trade_evaluation: "Emotional error", outcome: "Loss", resultaat_pct: -2 }),
      makeTrade({ trade_evaluation: "Technical error", outcome: "Win", resultaat_pct: 1 }),
      makeTrade({ trade_evaluation: null, outcome: "Win", resultaat_pct: 5 }),
      // Defensive: a stray missed trade must land in no bucket even if a caller forgets to filter.
      makeTrade({ trade_evaluation: "Missed trade", outcome: "Win", resultaat_pct: 10 }),
    ]);

    expect(impact.graded).toBe(4);
    expect(impact.errorN).toBe(2);

    const [good, emotional, technical] = impact.buckets;
    expect(good).toMatchObject({ n: 2, winRate: 0.5, totalR: 1, avgR: 0.5 });
    expect(emotional).toMatchObject({ n: 1, winRate: 0, totalR: -2, avgR: -2 });
    expect(technical).toMatchObject({ n: 1, winRate: 1, totalR: 1, avgR: 1 });

    expect(impact.goodAvgR).toBe(0.5);
    expect(impact.errorAvgR).toBe(-0.5);
    expect(impact.avgRGap).toBe(1);
    expect(impact.estimatedCostR).toBe(2); // 2 error trades × 1R gap
  });

  it("expresses buckets in R via riskPct (risk_pct-aware, default 1%)", () => {
    const impact = computeEvaluationImpact([
      // 2% result at 2% risk = 1R; legacy null risk = 1% → -1% is -1R.
      makeTrade({ trade_evaluation: "Good trade", outcome: "Win", resultaat_pct: 2, risk_pct: 2 }),
      makeTrade({ trade_evaluation: "Emotional error", outcome: "Loss", resultaat_pct: -1, risk_pct: null }),
    ]);
    expect(impact.goodAvgR).toBe(1);
    expect(impact.errorAvgR).toBe(-1);
    expect(impact.avgRGap).toBe(2);
  });

  it("keeps gaps null while one side is empty and allows a negative gap", () => {
    const onlyGood = computeEvaluationImpact([makeTrade({ trade_evaluation: "Good trade" })]);
    expect(onlyGood.goodAvgR).toBe(1);
    expect(onlyGood.avgRGap).toBeNull();
    expect(onlyGood.estimatedCostR).toBeNull();

    const luckyError = computeEvaluationImpact([
      makeTrade({ trade_evaluation: "Good trade", outcome: "Loss", resultaat_pct: -1 }),
      makeTrade({ trade_evaluation: "Emotional error", outcome: "Win", resultaat_pct: 3 }),
    ]);
    expect(luckyError.avgRGap).toBe(-4);
    expect(luckyError.estimatedCostR).toBe(-4);
  });

  it("rounds sums once, not per trade", () => {
    // Three raw R values of 0.333… would each round to 0.33 (sum 0.99); summing raw gives 1.
    const impact = computeEvaluationImpact([
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 1, risk_pct: 3 }),
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 1, risk_pct: 3 }),
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 1, risk_pct: 3 }),
    ]);
    expect(impact.buckets[0].totalR).toBe(1);
  });
});

describe("computeConditionGaps", () => {
  const sessieDim = { id: "sessie", keyFn: (t: { sessie: string }) => t.sessie } as const;

  it("measures the avg-R spread between best and worst value, ranked largest first", () => {
    const trades = [
      // sessie: London 2 winners (+2R avg), New York 2 losers (-1R avg) → gap 3
      makeTrade({ sessie: "London", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ sessie: "London", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ sessie: "New York", outcome: "Loss", resultaat_pct: -1 }),
      makeTrade({ sessie: "New York", outcome: "Loss", resultaat_pct: -1 }),
      // cc: bucket "11" (+2, -1 → +0.5 avg) vs "15" (+2, -1 → +0.5 avg): gap 0 → omitted
    ];
    trades[0].cc = "11";
    trades[2].cc = "11";
    trades[1].cc = "15";
    trades[3].cc = "15";

    const gaps = computeConditionGaps(trades, [sessieDim, { id: "cc", keyFn: (t) => t.cc }], { minSample: 2 });

    // The zero-gap cc dimension is omitted — no measurable difference to rank.
    expect(gaps.map((g) => g.dimensionId)).toEqual(["sessie"]);
    const sessie = gaps[0];
    expect(sessie.rows[0]).toMatchObject({ key: "London", n: 2, avgR: 2 });
    expect(sessie.rows[sessie.rows.length - 1]).toMatchObject({ key: "New York", n: 2, avgR: -1 });
    expect(sessie.gapR).toBe(3);
  });

  it("drops values under minSample and omits dimensions with fewer than two qualifying values", () => {
    const trades = [
      makeTrade({ sessie: "London", resultaat_pct: 1 }),
      makeTrade({ sessie: "London", resultaat_pct: 1 }),
      makeTrade({ sessie: "New York", resultaat_pct: -1 }), // n=1 < minSample
    ];
    expect(computeConditionGaps(trades, [sessieDim], { minSample: 2 })).toEqual([]);
  });

  it("structurally excludes missed trades, regardless of the caller", () => {
    const trades = [
      makeTrade({ sessie: "London", outcome: "Win", resultaat_pct: 1 }),
      makeTrade({ sessie: "London", outcome: "Win", resultaat_pct: 1 }),
      makeTrade({ sessie: "New York", outcome: "Loss", resultaat_pct: -1 }),
      makeTrade({ sessie: "New York", outcome: "Loss", resultaat_pct: -1 }),
      // Hypothetical big winner that would flip New York to "best" if it leaked in.
      makeTrade({ sessie: "New York", trade_evaluation: "Missed trade", outcome: "Win", resultaat_pct: 10 }),
    ];
    const [gap] = computeConditionGaps(trades, [sessieDim], { minSample: 2 });
    expect(gap.rows[0]).toMatchObject({ key: "London", avgR: 1 });
    expect(gap.rows[1]).toMatchObject({ key: "New York", n: 2, avgR: -1 });
  });

  it("excludes null keys and fans a key-array out to every bucket", () => {
    const trades = [
      makeTrade({ pair: "EURUSD", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ pair: "EURUSD", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ pair: "GBPUSD", outcome: "Loss", resultaat_pct: -2 }),
      makeTrade({ pair: "GBPUSD", outcome: "Loss", resultaat_pct: -2 }),
    ];
    const currencyDim = {
      id: "currency",
      keyFn: (t: { pair: string }) => [t.pair.slice(0, 3), t.pair.slice(3)],
    };
    const nullDim = { id: "empty", keyFn: () => null };

    const gaps = computeConditionGaps(trades, [currencyDim, nullDim], { minSample: 2 });
    expect(gaps).toHaveLength(1);
    const currency = gaps[0];
    // USD appears in all 4 trades (avg 0), EUR only in the winners, GBP only in the losers.
    expect(currency.rows.map((r) => r.key)).toEqual(["EUR", "USD", "GBP"]);
    expect(currency.rows[0].avgR).toBe(2);
    expect(currency.rows[1]).toMatchObject({ key: "USD", n: 4, avgR: 0 });
    expect(currency.gapR).toBe(4);
  });

  it("reports the error share among graded trades per value", () => {
    const trades = [
      makeTrade({ sessie: "London", trade_evaluation: "Good trade" }),
      makeTrade({ sessie: "London", trade_evaluation: "Emotional error" }),
      makeTrade({ sessie: "New York", trade_evaluation: null, resultaat_pct: -1 }),
      makeTrade({ sessie: "New York", trade_evaluation: null, resultaat_pct: -1 }),
    ];
    const [gap] = computeConditionGaps(trades, [sessieDim], { minSample: 2 });
    expect(gap.rows[0]).toMatchObject({ key: "London", errorRate: 0.5 });
    expect(gap.rows[1]).toMatchObject({ key: "New York", errorRate: null }); // nothing graded there
  });
});
