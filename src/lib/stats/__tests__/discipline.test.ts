import { describe, it, expect } from "vitest";
import { computeDisciplineImpact, isErrorEvaluation } from "../discipline";
import { makeTrade } from "./fixtures";

describe("isErrorEvaluation", () => {
  it("is true only for the two error evaluations", () => {
    expect(isErrorEvaluation("Emotional error")).toBe(true);
    expect(isErrorEvaluation("Technical error")).toBe(true);
    expect(isErrorEvaluation("Good trade")).toBe(false);
    expect(isErrorEvaluation("Missed trade")).toBe(false);
    expect(isErrorEvaluation(null)).toBe(false);
  });
});

describe("computeDisciplineImpact", () => {
  it("returns an all-zero result for an empty set", () => {
    const impact = computeDisciplineImpact([]);
    expect(impact).toEqual({
      takenCount: 0,
      errorCount: 0,
      errorRate: 0,
      errorResultPct: 0,
      errorCostPct: 0,
      missedCount: 0,
      missedResultPct: 0,
    });
  });

  it("sums the net result of error-flagged taken trades and the counterfactual cost", () => {
    const trades = [
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 2 }),
      makeTrade({ trade_evaluation: "Technical error", resultaat_pct: -1.5 }),
      makeTrade({ trade_evaluation: "Emotional error", resultaat_pct: -1 }),
      makeTrade({ trade_evaluation: null, resultaat_pct: 1 }),
    ];
    const impact = computeDisciplineImpact(trades);
    expect(impact.takenCount).toBe(4);
    expect(impact.errorCount).toBe(2);
    expect(impact.errorRate).toBe(0.5);
    expect(impact.errorResultPct).toBe(-2.5);
    // Removing the error trades would lift the total by +2.5%.
    expect(impact.errorCostPct).toBe(2.5);
  });

  it("counts a winning error trade as a positive contribution (no false 'cost')", () => {
    const trades = [makeTrade({ trade_evaluation: "Emotional error", resultaat_pct: 3 })];
    const impact = computeDisciplineImpact(trades);
    expect(impact.errorResultPct).toBe(3);
    expect(impact.errorCostPct).toBe(-3);
  });

  it("aggregates missed setups separately and never counts them as taken or error", () => {
    const trades = [
      makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 4 }),
      makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: -1 }),
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 1 }),
    ];
    const impact = computeDisciplineImpact(trades);
    expect(impact.takenCount).toBe(1);
    expect(impact.errorCount).toBe(0);
    expect(impact.missedCount).toBe(2);
    // Net forgone: +4 would-have-won minus 1 dodged loss = +3.
    expect(impact.missedResultPct).toBe(3);
  });

  it("keeps errorRate at 0 when there are only missed trades", () => {
    const impact = computeDisciplineImpact([makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 2 })]);
    expect(impact.takenCount).toBe(0);
    expect(impact.errorRate).toBe(0);
  });
});
