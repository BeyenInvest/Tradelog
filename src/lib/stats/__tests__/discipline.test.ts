import { describe, it, expect } from "vitest";
import { computeDisciplineImpact, computeMarketCapture, isErrorEvaluation } from "../discipline";
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
      takenResultPct: 0,
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

  it("tracks the net captured result across taken trades", () => {
    const impact = computeDisciplineImpact([
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 2 }),
      makeTrade({ trade_evaluation: "Technical error", resultaat_pct: -1 }),
      makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 5 }), // ignored for capture
    ]);
    expect(impact.takenResultPct).toBe(1);
  });
});

describe("computeMarketCapture", () => {
  it("returns null when there are no errors and no missed setups", () => {
    const impact = computeDisciplineImpact([makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 3 })]);
    expect(computeMarketCapture(impact)).toBeNull();
  });

  it("returns null when errors/skips net out to a help (nothing left on the table)", () => {
    // A winning emotional-error trade: errorCostPct is negative, missed absent.
    const impact = computeDisciplineImpact([makeTrade({ trade_evaluation: "Emotional error", resultaat_pct: 2 })]);
    expect(computeMarketCapture(impact)).toBeNull();
  });

  it("splits available into captured + left-on-table (positive capture)", () => {
    const impact = computeDisciplineImpact([
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 3.08 }),
      makeTrade({ trade_evaluation: "Technical error", resultaat_pct: -7.2 }),
      makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 5.44 }),
    ]);
    const cap = computeMarketCapture(impact)!;
    expect(cap.capturedPct).toBe(-4.12); // 3.08 + (-7.2)
    expect(cap.leftOnTablePct).toBe(12.64); // 7.2 error cost + 5.44 missed
    expect(cap.availablePct).toBe(8.52); // -4.12 + 12.64
  });

  it("handles a net-negative captured result (gave back into a positive market)", () => {
    // 24 taken netting -1.84, errors cost 6, missed 6.65 → 10.81 available, captured negative.
    const impact = computeDisciplineImpact([
      makeTrade({ trade_evaluation: "Good trade", resultaat_pct: 4.16 }),
      makeTrade({ trade_evaluation: "Emotional error", resultaat_pct: -6 }),
      makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 6.65 }),
    ]);
    const cap = computeMarketCapture(impact)!;
    expect(cap.capturedPct).toBe(-1.84);
    expect(cap.leftOnTablePct).toBe(12.65);
    expect(cap.availablePct).toBe(10.81);
    expect(cap.capturedShare).toBeLessThan(0);
  });
});
