import { describe, it, expect } from "vitest";
import { computeExitStats, maeR, mfeR } from "../exit";
import { closedTrades, takenTrades } from "../core";
import { makeTrade } from "./fixtures";

describe("maeR / mfeR", () => {
  it("converts the % magnitudes into R against the trade's risk", () => {
    const t = makeTrade({ resultaat_pct: 3, risk_pct: 2, mae_pct: 1, mfe_pct: 4 });
    expect(maeR(t)).toBe(0.5);
    expect(mfeR(t)).toBe(2);
  });

  it("falls back to the 1% default risk (same contract as rMultiple)", () => {
    const t = makeTrade({ resultaat_pct: 1, risk_pct: null, mae_pct: 0.8, mfe_pct: 2.1 });
    expect(maeR(t)).toBe(0.8);
    expect(mfeR(t)).toBe(2.1);
  });

  it("returns null when the trade doesn't track the excursion", () => {
    const t = makeTrade({ mae_pct: null, mfe_pct: null });
    expect(maeR(t)).toBeNull();
    expect(mfeR(t)).toBeNull();
  });
});

describe("computeExitStats", () => {
  it("returns an all-empty result on trades without any exit data", () => {
    const stats = computeExitStats([makeTrade(), makeTrade()]);
    expect(stats.nMae).toBe(0);
    expect(stats.nMfe).toBe(0);
    expect(stats.nPlanned).toBe(0);
    expect(stats.avgMaeRWinners).toBeNull();
    expect(stats.captureRate).toBeNull();
    expect(stats.avgPlannedRr).toBeNull();
    expect(stats.targetHitRate).toBeNull();
  });

  it("splits MAE by winner/loser on the sign of resultaat_pct and tracks the worst surviving winner", () => {
    const stats = computeExitStats([
      makeTrade({ resultaat_pct: 2, risk_pct: 1, mae_pct: 0.2 }), // winner, heat 0.2R
      makeTrade({ resultaat_pct: 1, risk_pct: 1, mae_pct: 0.6 }), // winner, heat 0.6R
      makeTrade({ resultaat_pct: -1, outcome: "Loss", risk_pct: 1, mae_pct: 1 }), // loser, heat 1R
      makeTrade({ resultaat_pct: 3, risk_pct: 1 }), // winner without MAE — not counted
    ]);
    expect(stats.nMae).toBe(3);
    expect(stats.nMaeWinners).toBe(2);
    expect(stats.avgMaeRWinners).toBe(0.4);
    expect(stats.nMaeLosers).toBe(1);
    expect(stats.avgMaeRLosers).toBe(1);
    expect(stats.maxMaeRWinners).toBe(0.6);
  });

  it("captureRate is a ratio of sums in R over trades that showed profit, and can go negative", () => {
    const stats = computeExitStats([
      makeTrade({ resultaat_pct: 1, risk_pct: 1, mfe_pct: 2 }), // took 1R of 2R
      makeTrade({ resultaat_pct: -1, outcome: "Loss", risk_pct: 1, mfe_pct: 2 }), // gave back a 2R peak into a -1R loss
    ]);
    // (1 + -1) / (2 + 2) = 0
    expect(stats.captureRate).toBe(0);
    expect(stats.losersInProfitN).toBe(1);
    expect(stats.avgLoserPeakR).toBe(2);
  });

  it("a trade whose MFE is 0 (never in profit) joins nMfe but not the capture ratio", () => {
    const stats = computeExitStats([
      makeTrade({ resultaat_pct: 2, risk_pct: 1, mfe_pct: 4 }),
      makeTrade({ resultaat_pct: -1, outcome: "Loss", risk_pct: 1, mfe_pct: 0 }),
    ]);
    expect(stats.nMfe).toBe(2);
    expect(stats.captureRate).toBe(0.5); // 2/4 — the straight-to-loss trade doesn't distort it
    expect(stats.losersInProfitN).toBe(0);
    expect(stats.avgLoserPeakR).toBeNull();
  });

  it("normalizes excursions per-trade risk before comparing (2% risk halves the R)", () => {
    const stats = computeExitStats([
      makeTrade({ resultaat_pct: 2, risk_pct: 2, mfe_pct: 4 }), // 1R realized of 2R peak
    ]);
    expect(stats.captureRate).toBe(0.5);
  });

  it("plan vs. realized: target hit on realized R, target availability on MFE R", () => {
    const stats = computeExitStats([
      // planned 2R, realized 3R (hit), peak 3R (was available)
      makeTrade({ resultaat_pct: 3, risk_pct: 1, planned_rr: 2, mfe_pct: 3 }),
      // planned 2R, realized 0.5R (miss), peak 2.5R (was available — left on the table)
      makeTrade({ resultaat_pct: 0.5, risk_pct: 1, planned_rr: 2, mfe_pct: 2.5 }),
      // planned 3R, realized -1R (miss), no MFE tracked → excluded from availability only
      makeTrade({ resultaat_pct: -1, outcome: "Loss", risk_pct: 1, planned_rr: 3 }),
    ]);
    expect(stats.nPlanned).toBe(3);
    expect(stats.avgPlannedRr).toBe(2.33);
    expect(stats.avgRealizedRPlanned).toBe(0.83);
    expect(stats.targetHitRate).toBeCloseTo(1 / 3);
    expect(stats.nTargetTracked).toBe(2);
    expect(stats.targetReachedRate).toBe(1);
  });

  it("counts trades that fell back to the assumed default risk", () => {
    const stats = computeExitStats([
      makeTrade({ resultaat_pct: 1, risk_pct: null, mae_pct: 0.5 }), // fallback
      makeTrade({ resultaat_pct: 1, risk_pct: 0.5, mfe_pct: 2 }), // explicit
      makeTrade({ resultaat_pct: 1, risk_pct: null }), // fallback but tracks nothing — not counted
    ]);
    expect(stats.assumedRiskN).toBe(1);
  });

  it("missed-trade contract: the caller's takenTrades/closedTrades gate keeps hypotheticals and open trades out", () => {
    const real = makeTrade({ resultaat_pct: 1, risk_pct: 1, mae_pct: 0.3 });
    const missed = makeTrade({ trade_evaluation: "Missed trade", resultaat_pct: 5, risk_pct: 1, mae_pct: 0.1 });
    const scoped = closedTrades(takenTrades([real, missed]));
    const stats = computeExitStats(scoped);
    expect(stats.nMae).toBe(1);
    expect(stats.avgMaeRWinners).toBe(0.3);
  });
});
