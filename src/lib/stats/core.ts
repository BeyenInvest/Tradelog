import type { Trade } from "../types";
import type { Outcome } from "../constants";

/**
 * Missed trades (trade_evaluation = "Missed trade") are hypothetical — a setup
 * seen but never taken. They must never count toward real performance
 * (resultaat, win-rate, streaks, drawdown, review stats, ...), only ever
 * appear in their own badged/toggled view. Every view applies this rule
 * through these three helpers rather than re-writing the filter locally.
 */
export function isMissed(trade: Pick<Trade, "trade_evaluation">): boolean {
  return trade.trade_evaluation === "Missed trade";
}

export function takenTrades<T extends Pick<Trade, "trade_evaluation">>(trades: T[]): T[] {
  return trades.filter((t) => !isMissed(t));
}

export function missedTrades<T extends Pick<Trade, "trade_evaluation">>(trades: T[]): T[] {
  return trades.filter(isMissed);
}

/** Sorts chronologically by datum_open, tie-broken by id for deterministic output. */
export function sortChronological(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    const d = a.datum_open.localeCompare(b.datum_open);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

export interface OutcomeCounts {
  n: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  lossRate: number;
  beRate: number;
  resultaatTotal: number;
}

/** Only needs outcome + resultaat_pct — callers may pass a narrower column selection than a full Trade. */
export function computeOutcomeCounts(trades: Pick<Trade, "outcome" | "resultaat_pct">[]): OutcomeCounts {
  const n = trades.length;
  const wins = trades.filter((t) => t.outcome === "Win").length;
  const losses = trades.filter((t) => t.outcome === "Loss").length;
  const be = trades.filter((t) => t.outcome === "BE").length;
  const resultaatTotal = round2(trades.reduce((s, t) => s + t.resultaat_pct, 0));
  return {
    n,
    wins,
    losses,
    be,
    winRate: n ? wins / n : 0,
    lossRate: n ? losses / n : 0,
    beRate: n ? be / n : 0,
    resultaatTotal,
  };
}

export interface StreakResult {
  maxWinningStreak: number;
  maxLosingStreak: number;
  currentStreak: { type: Outcome | "none"; count: number };
}

/**
 * Rekenregel 3: a winning streak is only broken by a Loss (not BE); a losing
 * streak only by a Win (not BE). BE pauses the streak — it neither resets nor
 * extends it. Sorts chronologically by datum_open internally.
 */
export function computeStreaks(trades: Trade[]): StreakResult {
  const sorted = sortChronological(trades);

  let maxWinningStreak = 0;
  let maxLosingStreak = 0;
  let currentType: Outcome | "none" = "none";
  let currentCount = 0;

  for (const t of sorted) {
    if (t.outcome === "BE") {
      continue; // pause: no reset, no increment
    }
    if (t.outcome === currentType) {
      currentCount += 1;
    } else {
      currentType = t.outcome;
      currentCount = 1;
    }
    if (currentType === "Win") maxWinningStreak = Math.max(maxWinningStreak, currentCount);
    if (currentType === "Loss") maxLosingStreak = Math.max(maxLosingStreak, currentCount);
  }

  return {
    maxWinningStreak,
    maxLosingStreak,
    currentStreak: { type: currentType, count: currentCount },
  };
}

export interface DrawdownResult {
  maxDrawdownPct: number;
  peakTradeId: string | null;
  troughTradeId: string | null;
}

/**
 * Rekenregel 4: largest pullback (%) from a running peak in the chronological
 * cumulative resultaat curve, across all fases combined, sorted by datum_open.
 */
export function computeMaxDrawdown(trades: Trade[]): DrawdownResult {
  const sorted = sortChronological(trades);

  let cum = 0;
  let peak = -Infinity;
  let peakTradeId: string | null = null;
  let maxDrawdownPct = 0;
  let troughTradeId: string | null = null;

  for (const t of sorted) {
    cum += t.resultaat_pct;
    if (cum > peak) {
      peak = cum;
      peakTradeId = t.id;
    }
    const dd = peak - cum;
    if (dd > maxDrawdownPct) {
      maxDrawdownPct = dd;
      troughTradeId = t.id;
    }
  }

  return { maxDrawdownPct: round2(maxDrawdownPct), peakTradeId, troughTradeId };
}

export interface ExpectancyResult {
  avgWin: number | null;
  avgLoss: number | null;
  winLossRatio: number | null;
}

/**
 * Rekenregel 5: based on the sign of resultaat_pct itself (not the outcome
 * enum), matching the spec's literal definition.
 */
export function computeExpectancy(trades: Trade[]): ExpectancyResult {
  const winValues = trades.map((t) => t.resultaat_pct).filter((v) => v > 0);
  const lossValues = trades.map((t) => t.resultaat_pct).filter((v) => v < 0);

  const avgWin = winValues.length ? round2(mean(winValues)) : null;
  const avgLoss = lossValues.length ? round2(mean(lossValues)) : null;
  const winLossRatio = avgWin != null && avgLoss ? round2(Math.abs(avgWin / avgLoss)) : null;

  return { avgWin, avgLoss, winLossRatio };
}

export interface EquityPoint {
  idx: number;
  tradeId: string;
  datumOpen: string;
  cum: number;
}

export function computeEquityCurve(trades: Trade[]): EquityPoint[] {
  const sorted = sortChronological(trades);
  let cum = 0;
  return sorted.map((t, i) => {
    cum += t.resultaat_pct;
    return { idx: i + 1, tradeId: t.id, datumOpen: t.datum_open, cum: round2(cum) };
  });
}

export interface OverviewKpis {
  totalTrades: number;
  totalResultaat: number;
  winRate: number;
  beRate: number;
  lossRate: number;
  wins: number;
  losses: number;
  be: number;
  maxWinningStreak: number;
  maxLosingStreak: number;
  currentStreak: { type: Outcome | "none"; count: number };
  avgWin: number | null;
  avgLoss: number | null;
  winLossRatio: number | null;
  maxDrawdownPct: number;
}

/**
 * Single entry point for the Overview KPI row — every view that needs these
 * numbers calls this instead of recomputing streaks/drawdown/expectancy itself.
 */
export function computeOverviewKpis(trades: Trade[]): OverviewKpis {
  const counts = computeOutcomeCounts(trades);
  const streaks = computeStreaks(trades);
  const drawdown = computeMaxDrawdown(trades);
  const expectancy = computeExpectancy(trades);

  return {
    totalTrades: counts.n,
    totalResultaat: counts.resultaatTotal,
    winRate: counts.winRate,
    beRate: counts.beRate,
    lossRate: counts.lossRate,
    wins: counts.wins,
    losses: counts.losses,
    be: counts.be,
    maxWinningStreak: streaks.maxWinningStreak,
    maxLosingStreak: streaks.maxLosingStreak,
    currentStreak: streaks.currentStreak,
    avgWin: expectancy.avgWin,
    avgLoss: expectancy.avgLoss,
    winLossRatio: expectancy.winLossRatio,
    maxDrawdownPct: drawdown.maxDrawdownPct,
  };
}

export interface ErrorCounts {
  emotional: number;
  technical: number;
  missedCount: number;
  missedResultaat: number;
}

/**
 * Raw counts only — no synthesized "cost" narrative (that framing was tried
 * and rejected). Just how many taken trades were self-flagged as an error,
 * and how many trades were missed with what hypothetical result.
 */
export function computeErrorCounts(taken: Trade[], missed: Trade[]): ErrorCounts {
  return {
    emotional: taken.filter((t) => t.trade_evaluation === "Emotional error").length,
    technical: taken.filter((t) => t.trade_evaluation === "Technical error").length,
    missedCount: missed.length,
    missedResultaat: round2(missed.reduce((s, t) => s + t.resultaat_pct, 0)),
  };
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
