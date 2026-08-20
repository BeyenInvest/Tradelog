import { describe, it, expect } from "vitest";
import { computeStreaks, computeMaxDrawdown, computeExpectancy, computeProfitFactor, computeOutcomeCounts, round2, riskPct, rMultiple, computeRStats, lastNChronological, computeDisciplineStats, computeDisciplineCurve, computeEquityCurve, isOpen, closedTrades, takenTrades, computeOverviewKpis } from "../core";
import { makeSequence, makeTrade } from "./fixtures";

describe("round2", () => {
  it("normalizes an exact-zero negative sum (-0) to 0", () => {
    expect(Object.is(round2(-0.001), -0)).toBe(false);
    expect(round2(-0.001)).toBe(0);
  });

  it("rounds to 2 decimals otherwise", () => {
    expect(round2(1.239)).toBe(1.24);
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe("computeStreaks", () => {
  it("BE pauses a winning streak — does not reset or extend it", () => {
    const trades = makeSequence(["Win", "BE", "Win"]);
    const { maxWinningStreak, maxLosingStreak } = computeStreaks(trades);
    expect(maxWinningStreak).toBe(2);
    expect(maxLosingStreak).toBe(0);
  });

  it("BE pauses a losing streak — does not reset or extend it", () => {
    const trades = makeSequence(["Loss", "BE", "BE", "Loss"]);
    const { maxLosingStreak } = computeStreaks(trades);
    expect(maxLosingStreak).toBe(2);
  });

  it("a Loss breaks a winning streak", () => {
    const trades = makeSequence(["Win", "Win", "Loss"]);
    const { maxWinningStreak, maxLosingStreak } = computeStreaks(trades);
    expect(maxWinningStreak).toBe(2);
    expect(maxLosingStreak).toBe(1);
  });

  it("a Win breaks a losing streak", () => {
    const trades = makeSequence(["Loss", "Loss", "Loss", "Win"]);
    const { maxLosingStreak, maxWinningStreak } = computeStreaks(trades);
    expect(maxLosingStreak).toBe(3);
    expect(maxWinningStreak).toBe(1);
  });

  it("current streak reports through trailing BEs without losing the type/count", () => {
    const trades = makeSequence(["Win", "Win", "BE", "BE"]);
    const { currentStreak } = computeStreaks(trades);
    expect(currentStreak).toEqual({ type: "Win", count: 2 });
  });

  it("sorts internally by datum_open — unsorted input gives identical output to sorted input", () => {
    const sorted = makeSequence(["Win", "Win", "Loss", "Win"]);
    const shuffled = [sorted[2], sorted[0], sorted[3], sorted[1]];
    expect(computeStreaks(shuffled)).toEqual(computeStreaks(sorted));
  });

  it("empty input does not throw", () => {
    expect(computeStreaks([])).toEqual({
      maxWinningStreak: 0,
      maxLosingStreak: 0,
      currentStreak: { type: "none", count: 0 },
    });
  });
});

describe("computeMaxDrawdown", () => {
  it("matches a hand-computed cumulative sequence", () => {
    // cum: 2, 1, 4, 0, 1, 0.5, 5.5 -> peaks: 2,2,4,4,4,4,5.5 -> dd: 0,1,0,4,3,3.5,0
    const values = [2, -1, 3, -4, 1, -0.5, 5];
    const trades = values.map((v, i) =>
      makeTrade({ datum_open: `2026-01-${String(i + 1).padStart(2, "0")}`, resultaat_pct: v, outcome: v >= 0 ? "Win" : "Loss" })
    );
    const { maxDrawdownPct } = computeMaxDrawdown(trades);
    expect(maxDrawdownPct).toBe(4);
  });

  it("is zero when every trade is a win", () => {
    const trades = makeSequence(["Win", "Win", "Win"]);
    expect(computeMaxDrawdown(trades).maxDrawdownPct).toBe(0);
  });

  it("is zero for a single trade", () => {
    const trades = makeSequence(["Loss"]);
    expect(computeMaxDrawdown(trades).maxDrawdownPct).toBe(0);
  });

  it("does not throw on an empty array", () => {
    expect(() => computeMaxDrawdown([])).not.toThrow();
    expect(computeMaxDrawdown([]).maxDrawdownPct).toBe(0);
  });
});

describe("computeExpectancy", () => {
  it("avgLoss and winLossRatio are null when there are no losses", () => {
    const trades = makeSequence(["Win", "Win"]);
    const result = computeExpectancy(trades);
    expect(result.avgLoss).toBeNull();
    expect(result.winLossRatio).toBeNull();
    expect(result.avgWin).toBe(1);
  });

  it("avgWin and winLossRatio are null when there are no wins", () => {
    const trades = makeSequence(["Loss", "Loss"]);
    const result = computeExpectancy(trades);
    expect(result.avgWin).toBeNull();
    expect(result.winLossRatio).toBeNull();
    expect(result.avgLoss).toBe(-1);
  });

  it("computes the exact ratio for a mixed set", () => {
    const trades = [
      makeTrade({ resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ resultaat_pct: 4, outcome: "Win" }),
      makeTrade({ resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ resultaat_pct: -3, outcome: "Loss" }),
    ];
    const result = computeExpectancy(trades);
    expect(result.avgWin).toBe(3); // (2+4)/2
    expect(result.avgLoss).toBe(-2); // (-1-3)/2
    expect(result.winLossRatio).toBe(1.5); // abs(3/-2)
  });

  it("BE trades (resultaat_pct 0) are excluded from both buckets", () => {
    const trades = makeSequence(["Win", "BE", "Loss"]);
    const result = computeExpectancy(trades);
    expect(result.avgWin).toBe(1);
    expect(result.avgLoss).toBe(-1);
  });
});

describe("computeProfitFactor", () => {
  it("divides gross profit by gross loss", () => {
    const trades = [
      makeTrade({ resultaat_pct: 2, outcome: "Win" }),
      makeTrade({ resultaat_pct: 4, outcome: "Win" }),
      makeTrade({ resultaat_pct: -1, outcome: "Loss" }),
      makeTrade({ resultaat_pct: -3, outcome: "Loss" }),
    ];
    const result = computeProfitFactor(trades);
    expect(result.grossProfit).toBe(6);
    expect(result.grossLoss).toBe(4);
    expect(result.profitFactor).toBe(1.5); // 6 / 4
  });

  it("is Infinity when there are winners but no losers", () => {
    const result = computeProfitFactor(makeSequence(["Win", "Win"]));
    expect(result.grossLoss).toBe(0);
    expect(result.profitFactor).toBe(Infinity);
  });

  it("is null when nothing is decisive (no winners and no losers)", () => {
    const result = computeProfitFactor(makeSequence(["BE", "BE"]));
    expect(result.grossProfit).toBe(0);
    expect(result.grossLoss).toBe(0);
    expect(result.profitFactor).toBeNull();
  });

  it("is null for an empty set", () => {
    expect(computeProfitFactor([]).profitFactor).toBeNull();
  });

  it("sign of resultaat_pct decides the side, not the outcome enum", () => {
    // A 'Win' logged at exactly 0% lands on neither side (BE-like).
    const trades = [
      makeTrade({ resultaat_pct: 0, outcome: "Win" }),
      makeTrade({ resultaat_pct: 3, outcome: "Win" }),
      makeTrade({ resultaat_pct: -1.5, outcome: "Loss" }),
    ];
    const result = computeProfitFactor(trades);
    expect(result.grossProfit).toBe(3);
    expect(result.grossLoss).toBe(1.5);
    expect(result.profitFactor).toBe(2);
  });
});

describe("riskPct / rMultiple (non-intrusive R)", () => {
  it("treats a null risk_pct as the default 1% — R equals resultaat_pct", () => {
    const t = makeTrade({ resultaat_pct: 3, risk_pct: null });
    expect(riskPct(t)).toBe(1);
    expect(rMultiple(t)).toBe(3);
  });

  it("treats a zero/negative risk_pct as the default 1% (defensive guard)", () => {
    expect(riskPct(makeTrade({ risk_pct: 0 }))).toBe(1);
    expect(riskPct(makeTrade({ risk_pct: -2 }))).toBe(1);
  });

  it("divides result by an explicit risk — RR-style trades", () => {
    expect(rMultiple(makeTrade({ resultaat_pct: 3, risk_pct: 1 }))).toBe(3); // 1:3
    expect(rMultiple(makeTrade({ resultaat_pct: 3, risk_pct: 3 }))).toBe(1); // 1:1 at 3% risk
    expect(rMultiple(makeTrade({ resultaat_pct: 1.5, risk_pct: 0.5 }))).toBe(3);
  });

  it("preserves sign for losses", () => {
    expect(rMultiple(makeTrade({ resultaat_pct: -2, risk_pct: 2 }))).toBe(-1);
  });
});

describe("computeRStats", () => {
  it("returns totalR 0 and avgR null for no trades", () => {
    expect(computeRStats([])).toEqual({ totalR: 0, avgR: null });
  });

  it("for legacy (all null risk) trades, totalR equals total resultaat_pct", () => {
    const trades = [
      makeTrade({ resultaat_pct: 3, risk_pct: null }),
      makeTrade({ resultaat_pct: -1, risk_pct: null }),
      makeTrade({ resultaat_pct: 2, risk_pct: null }),
    ];
    expect(computeRStats(trades)).toEqual({ totalR: 4, avgR: round2(4 / 3) });
  });

  it("aggregates mixed variable-risk trades", () => {
    const trades = [
      makeTrade({ resultaat_pct: 3, risk_pct: 1 }), // +3R
      makeTrade({ resultaat_pct: -3, risk_pct: 3 }), // -1R
      makeTrade({ resultaat_pct: 2, risk_pct: 2 }), // +1R
    ];
    expect(computeRStats(trades)).toEqual({ totalR: 3, avgR: 1 });
  });
});

describe("lastNChronological (rolling window)", () => {
  it("returns the last n trades chronologically, even from an unordered input", () => {
    const seq = makeSequence(["Win", "Loss", "Win", "BE", "Loss"]); // 2026-01-01..05
    const shuffled = [seq[3], seq[0], seq[4], seq[1], seq[2]];
    expect(lastNChronological(shuffled, 3).map((t) => t.datum_open)).toEqual([
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("returns all trades (sorted) when n exceeds the count", () => {
    const seq = makeSequence(["Win", "Loss"]);
    expect(lastNChronological([seq[1], seq[0]], 10).map((t) => t.datum_open)).toEqual([
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("returns [] for n <= 0", () => {
    const seq = makeSequence(["Win", "Loss"]);
    expect(lastNChronological(seq, 0)).toEqual([]);
    expect(lastNChronological(seq, -5)).toEqual([]);
  });
});

describe("computeOutcomeCounts", () => {
  it("computes rates and total against a hand count", () => {
    const trades = makeSequence(["Win", "Win", "Loss", "BE"]);
    const result = computeOutcomeCounts(trades);
    expect(result).toMatchObject({ n: 4, wins: 2, losses: 1, be: 1, winRate: 0.5, resultaatTotal: 1 });
  });
});

describe("computeDisciplineStats", () => {
  it("rate is null when nothing is graded", () => {
    const trades = [makeTrade({ trade_evaluation: null }), makeTrade({ trade_evaluation: null })];
    expect(computeDisciplineStats(trades)).toEqual({ evaluated: 0, good: 0, emotional: 0, technical: 0, rate: null });
  });

  it("counts each grade and rate = good / graded", () => {
    const trades = [
      makeTrade({ trade_evaluation: "Good trade" }),
      makeTrade({ trade_evaluation: "Good trade" }),
      makeTrade({ trade_evaluation: "Good trade" }),
      makeTrade({ trade_evaluation: "Emotional error" }),
    ];
    expect(computeDisciplineStats(trades)).toEqual({ evaluated: 4, good: 3, emotional: 1, technical: 0, rate: 0.75 });
  });

  it("ungraded taken trades count toward neither numerator nor denominator", () => {
    const trades = [
      makeTrade({ trade_evaluation: "Good trade" }),
      makeTrade({ trade_evaluation: null }),
      makeTrade({ trade_evaluation: "Emotional error" }),
    ];
    const result = computeDisciplineStats(trades);
    expect(result.evaluated).toBe(2);
    expect(result.rate).toBe(0.5);
  });
});

describe("computeDisciplineCurve", () => {
  it("returns one point per graded trade, ignoring ungraded ones", () => {
    const trades = [
      makeTrade({ datum_open: "2026-01-01", trade_evaluation: "Good trade" }),
      makeTrade({ datum_open: "2026-01-02", trade_evaluation: null }),
      makeTrade({ datum_open: "2026-01-03", trade_evaluation: "Emotional error" }),
    ];
    const curve = computeDisciplineCurve(trades);
    expect(curve.map((p) => p.cumRate)).toEqual([100, 50]);
    expect(curve.map((p) => p.idx)).toEqual([1, 2]);
  });

  it("tracks the running good-rate chronologically regardless of input order", () => {
    const trades = [
      makeTrade({ datum_open: "2026-01-04", trade_evaluation: "Good trade" }),
      makeTrade({ datum_open: "2026-01-01", trade_evaluation: "Emotional error" }),
      makeTrade({ datum_open: "2026-01-03", trade_evaluation: "Good trade" }),
      makeTrade({ datum_open: "2026-01-02", trade_evaluation: "Technical error" }),
    ];
    // Chronological grades: Emotional, Technical, Good, Good -> good-so-far/n
    expect(computeDisciplineCurve(trades).map((p) => p.cumRate)).toEqual([0, 0, round2((1 / 3) * 100), 50]);
  });

  it("is empty when nothing is graded", () => {
    expect(computeDisciplineCurve([makeTrade({ trade_evaluation: null })])).toEqual([]);
  });
});

describe("computeEquityCurve", () => {
  it("simple mode sums resultaat_pct chronologically", () => {
    const trades = makeSequence([
      { outcome: "Win", resultaat_pct: 10 },
      { outcome: "Loss", resultaat_pct: -4 },
      { outcome: "Win", resultaat_pct: 2 },
    ]);
    expect(computeEquityCurve(trades).map((p) => p.cum)).toEqual([10, 6, 8]);
  });

  it("orders chronologically by datum_open regardless of input order", () => {
    const trades = [
      makeTrade({ id: "b", datum_open: "2026-01-02", resultaat_pct: 3 }),
      makeTrade({ id: "a", datum_open: "2026-01-01", resultaat_pct: 1 }),
    ];
    expect(computeEquityCurve(trades).map((p) => ({ id: p.tradeId, cum: p.cum }))).toEqual([
      { id: "a", cum: 1 },
      { id: "b", cum: 4 },
    ]);
  });

  it("is empty for no trades", () => {
    expect(computeEquityCurve([])).toEqual([]);
  });
});

describe("open (still-running) trades", () => {
  it("isOpen reflects the is_open flag", () => {
    expect(isOpen(makeTrade({ is_open: true }))).toBe(true);
    expect(isOpen(makeTrade({ is_open: false }))).toBe(false);
  });

  it("closedTrades drops still-running trades, keeping closed (incl. missed) ones", () => {
    const trades = [
      makeTrade({ id: "a", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ id: "b", is_open: true }),
      makeTrade({ id: "c", outcome: "Loss", resultaat_pct: -1, trade_evaluation: "Missed trade" }),
    ];
    expect(closedTrades(trades).map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("an open trade never dilutes realized KPIs once routed through closedTrades", () => {
    const closed = makeSequence(["Win", "Loss"]); // +1, -1
    const withOpen = [...closed, makeTrade({ id: "open-1", is_open: true, resultaat_pct: 999, outcome: "Win" })];
    // Same as if the open trade weren't there at all.
    expect(computeOverviewKpis(closedTrades(withOpen))).toEqual(computeOverviewKpis(closed));
    expect(computeOverviewKpis(closedTrades(withOpen)).totalTrades).toBe(2);
  });

  it("closedTrades composes with takenTrades to drop both open and missed", () => {
    const trades = [
      makeTrade({ id: "real", outcome: "Win", resultaat_pct: 1 }),
      makeTrade({ id: "open", is_open: true }),
      makeTrade({ id: "missed", trade_evaluation: "Missed trade", resultaat_pct: 5, outcome: "Win" }),
    ];
    expect(closedTrades(takenTrades(trades)).map((t) => t.id)).toEqual(["real"]);
  });
});
