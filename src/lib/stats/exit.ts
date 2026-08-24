import { hasExplicitRisk, mean, riskPct, round2, type ClosedTrade } from "./core";

/**
 * Exit-analyse (Fase N3) over the optional MAE/MFE/planned_rr columns (0049).
 *
 * All numbers are expressed in R (value / riskPct(t)) so trades taken at
 * different risk sizes stay comparable — the same fallback contract as
 * computeRStats: a trade without an explicit risk % is read at the 1% default.
 * Same caller contract as every realized-performance helper in core.ts: pass an
 * already-scoped, missed-excluded closed list (closedTrades(takenTrades(...))) —
 * a hypothetical "Missed trade" has no real excursions to analyse.
 *
 * Each metric only reads the trades that actually carry its column(s); the n*
 * counts say how much data each conclusion rests on.
 */

/** The trade slice the exit stats read. */
export type ExitTrade = Pick<ClosedTrade, "resultaat_pct" | "risk_pct" | "mae_pct" | "mfe_pct" | "planned_rr">;

/** MAE in R (positive magnitude); null when the trade doesn't track it. */
export function maeR(t: ExitTrade): number | null {
  return t.mae_pct != null ? round2(t.mae_pct / riskPct(t)) : null;
}

/** MFE in R (positive magnitude); null when the trade doesn't track it. */
export function mfeR(t: ExitTrade): number | null {
  return t.mfe_pct != null ? round2(t.mfe_pct / riskPct(t)) : null;
}

export interface ExitStats {
  /** Trades carrying mae_pct / mfe_pct / planned_rr respectively. */
  nMae: number;
  nMfe: number;
  nPlanned: number;
  /** Any trade in the analysed set that fell back to the assumed 1% risk — > 0 marks the R numbers as partly assumed. */
  assumedRiskN: number;

  // --- Stop-analyse (MAE) ---
  /** Mean MAE in R of the winners (resultaat_pct > 0) that track MAE — the "heat" a winner typically survives. null without such trades. */
  avgMaeRWinners: number | null;
  nMaeWinners: number;
  /** Mean MAE in R of the losers (resultaat_pct < 0) that track MAE. null without such trades. */
  avgMaeRLosers: number | null;
  nMaeLosers: number;
  /** Worst MAE any winner survived (in R) — the direct "a stop this tight would have kept every tracked winner" number. null without MAE-tracked winners. */
  maxMaeRWinners: number | null;

  // --- Exit-efficiëntie (MFE) ---
  /**
   * Share of the maximum available profit that was actually realized:
   * sum(realized R) / sum(MFE R) over trades with mfe > 0, as a ratio of sums
   * (robust against near-zero per-trade MFEs). Can be negative — losers that
   * were in profit drag it below zero, which is exactly the signal. null when
   * no tracked trade ever showed profit.
   */
  captureRate: number | null;
  /** Losers (resultaat_pct < 0) that were in profit at some point (mfe_pct > 0) — winners given back entirely. */
  losersInProfitN: number;
  /** Mean peak profit (MFE in R) of those losers-in-profit. null when there are none. */
  avgLoserPeakR: number | null;

  // --- Plan vs. realisatie (planned R:R) ---
  /** Mean planned reward:risk over trades that set one. null without data. */
  avgPlannedRr: number | null;
  /** Mean realized R over those same trades — plan vs. outcome on an equal footing. null without data. */
  avgRealizedRPlanned: number | null;
  /** Of trades with BOTH planned_rr and MFE: share where the target was actually available intra-trade (mfeR >= planned_rr). null without such trades. */
  targetReachedRate: number | null;
  nTargetTracked: number;
  /** Of trades with planned_rr: share that realized it (realized R >= planned_rr). null without data. */
  targetHitRate: number | null;
}

export function computeExitStats(trades: ExitTrade[]): ExitStats {
  const withMae = trades.filter((t) => t.mae_pct != null);
  const withMfe = trades.filter((t) => t.mfe_pct != null);
  const withPlan = trades.filter((t) => t.planned_rr != null);
  const tracked = trades.filter((t) => t.mae_pct != null || t.mfe_pct != null || t.planned_rr != null);

  // Winner/loser by the sign of resultaat_pct — the same lens computeExpectancy
  // and computeProfitFactor use, so "winners" means the same thing everywhere.
  const maeWinners = withMae.filter((t) => t.resultaat_pct > 0);
  const maeLosers = withMae.filter((t) => t.resultaat_pct < 0);
  const maeRsWinners = maeWinners.map((t) => t.mae_pct! / riskPct(t));
  const maeRsLosers = maeLosers.map((t) => t.mae_pct! / riskPct(t));

  // Ratio of sums, both in R: how much of the profit that was on the table got taken.
  const inProfit = withMfe.filter((t) => t.mfe_pct! > 0);
  const sumMfeR = inProfit.reduce((s, t) => s + t.mfe_pct! / riskPct(t), 0);
  const sumRealizedR = inProfit.reduce((s, t) => s + t.resultaat_pct / riskPct(t), 0);

  const losersInProfit = inProfit.filter((t) => t.resultaat_pct < 0);

  const targetTracked = withPlan.filter((t) => t.mfe_pct != null);
  const targetReached = targetTracked.filter((t) => t.mfe_pct! / riskPct(t) >= t.planned_rr!);
  const targetHit = withPlan.filter((t) => t.resultaat_pct / riskPct(t) >= t.planned_rr!);

  return {
    nMae: withMae.length,
    nMfe: withMfe.length,
    nPlanned: withPlan.length,
    assumedRiskN: tracked.filter((t) => !hasExplicitRisk(t)).length,

    avgMaeRWinners: maeRsWinners.length ? round2(mean(maeRsWinners)) : null,
    nMaeWinners: maeWinners.length,
    avgMaeRLosers: maeRsLosers.length ? round2(mean(maeRsLosers)) : null,
    nMaeLosers: maeLosers.length,
    maxMaeRWinners: maeRsWinners.length ? round2(Math.max(...maeRsWinners)) : null,

    captureRate: sumMfeR > 0 ? round2(sumRealizedR / sumMfeR) : null,
    losersInProfitN: losersInProfit.length,
    avgLoserPeakR: losersInProfit.length ? round2(mean(losersInProfit.map((t) => t.mfe_pct! / riskPct(t)))) : null,

    avgPlannedRr: withPlan.length ? round2(mean(withPlan.map((t) => t.planned_rr!))) : null,
    avgRealizedRPlanned: withPlan.length ? round2(mean(withPlan.map((t) => t.resultaat_pct / riskPct(t)))) : null,
    targetReachedRate: targetTracked.length ? targetReached.length / targetTracked.length : null,
    nTargetTracked: targetTracked.length,
    targetHitRate: withPlan.length ? targetHit.length / withPlan.length : null,
  };
}
