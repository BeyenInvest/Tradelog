import { describe, it, expect } from "vitest";
import { computeOutcomeCounts, computeStreaks, computeMaxDrawdown } from "../core";
import { computeTpfsStats, tpfsOutcomeOf } from "../tpfs";
import { makeSequence, makeTrade } from "./fixtures";

describe("tpfsOutcomeOf", () => {
  it("derives outcome purely from the sign of tpfs_pct", () => {
    expect(tpfsOutcomeOf(1.5)).toBe("Win");
    expect(tpfsOutcomeOf(-0.2)).toBe("Loss");
    expect(tpfsOutcomeOf(0)).toBe("BE");
  });
});

describe("rekenregel 2 — TPFS never excludes trades from the main statistics", () => {
  it("core stats are identical whether or not trades carry a tpfs_pct value", () => {
    const withTpfs = makeSequence(["Win", "BE", "Win", "Loss", "Win"]).map((t, i) =>
      makeTrade({ ...t, tpfs_pct: [2, 0, 1.4, -3, 0.6][i] })
    );
    const withoutTpfs = withTpfs.map((t) => makeTrade({ ...t, tpfs_pct: null }));

    expect(computeOutcomeCounts(withTpfs)).toEqual(computeOutcomeCounts(withoutTpfs));
    expect(computeStreaks(withTpfs)).toEqual(computeStreaks(withoutTpfs));
    expect(computeMaxDrawdown(withTpfs)).toEqual(computeMaxDrawdown(withoutTpfs));
  });
});

describe("computeTpfsStats", () => {
  it("only counts trades with a non-null tpfs_pct", () => {
    const trades = [
      makeTrade({ tpfs_pct: 1.2 }),
      makeTrade({ tpfs_pct: null }),
      makeTrade({ tpfs_pct: -0.5 }),
    ];
    expect(computeTpfsStats(trades).n).toBe(2);
  });

  it("derives win/loss/be counts from the sign of tpfs_pct, not the real outcome", () => {
    const trades = [
      makeTrade({ outcome: "Loss", resultaat_pct: -1, tpfs_pct: 2 }), // real Loss, hypothetical Win
      makeTrade({ outcome: "Win", resultaat_pct: 1, tpfs_pct: -0.5 }), // real Win, hypothetical Loss
    ];
    const stats = computeTpfsStats(trades);
    expect(stats.winRate).toBe(0.5);
    expect(stats.lossRate).toBe(0.5);
  });
});
