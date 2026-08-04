import { describe, it, expect } from "vitest";
import { computeStreaks, computeMaxDrawdown, computeExpectancy, computeOutcomeCounts, round2 } from "../core";
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

describe("computeOutcomeCounts", () => {
  it("computes rates and total against a hand count", () => {
    const trades = makeSequence(["Win", "Win", "Loss", "BE"]);
    const result = computeOutcomeCounts(trades);
    expect(result).toMatchObject({ n: 4, wins: 2, losses: 1, be: 1, winRate: 0.5, resultaatTotal: 1 });
  });
});
