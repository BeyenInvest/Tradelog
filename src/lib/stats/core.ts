import type { Trade } from "../types";
import type { Outcome } from "../constants";
import { DEFAULT_RISK_PCT } from "../constants";

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

/**
 * A closed trade — the narrowed shape every realized-performance helper reads.
 * A still-running trade (is_open) has no result yet, so its outcome/resultaat_pct
 * are null; a closed trade always carries both (DB check trades_open_result_chk).
 */
export type ClosedTrade = Omit<Trade, "outcome" | "resultaat_pct"> & { outcome: Outcome; resultaat_pct: number };

/**
 * Still-running trade (migration 0043) — logged before it's closed, no realized
 * result yet. Excluded from every realized number, the same way isMissed() marks
 * hypothetical ones — but it's a *separate* axis: a missed trade is closed (carries
 * a hypothetical result), an open trade is not (carries none).
 */
export function isOpen(trade: Pick<Trade, "is_open">): boolean {
  return trade.is_open;
}

/**
 * The single gate that turns a mixed trade list into realized-performance input:
 * drops still-running trades AND narrows outcome/resultaat_pct to non-null, so no
 * downstream stat has to null-check. Missed trades pass through (they're closed) —
 * pair with takenTrades() to exclude those too. Every realized number routes its
 * input through here (as tsc enforces, since the aggregators now require non-null).
 */
export function closedTrades<T extends Pick<Trade, "is_open" | "outcome" | "resultaat_pct">>(
  trades: T[]
): (T & { outcome: Outcome; resultaat_pct: number })[] {
  return trades.filter((t): t is T & { outcome: Outcome; resultaat_pct: number } => !t.is_open);
}

/**
 * Taken trade carrying one of the three execution grades (GRADED_EVALUATIONS in
 * constants.ts) — ungraded (null) and hypothetical "Missed trade" rows count
 * toward no discipline/adherence stat. The single classification every
 * discipline/adherence helper routes through.
 */
export function isGraded(trade: Pick<Trade, "trade_evaluation">): boolean {
  return trade.trade_evaluation != null && !isMissed(trade);
}

/** Graded as a rule deviation: an Emotional or Technical error. */
export function isGradedError(trade: Pick<Trade, "trade_evaluation">): boolean {
  return isGraded(trade) && trade.trade_evaluation !== "Good trade";
}

/** Sorts chronologically by datum_open, tie-broken by id for deterministic output. Generic so a narrowed list (e.g. ClosedTrade[]) keeps its type through the sort. */
export function sortChronological<T extends Pick<Trade, "id" | "datum_open">>(trades: T[]): T[] {
  return [...trades].sort((a, b) => {
    const d = a.datum_open.localeCompare(b.datum_open);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

/**
 * The last `n` trades chronologically (most recent by datum_open, tie-broken by
 * id) — the "rolling window" / recent-form snapshot. Returns a chronologically
 * ascending slice, so downstream stats (streaks, equity curve, R) read it the
 * same as a full list. `n <= 0` returns []; fewer than `n` trades returns them
 * all. Caller passes an already-scoped, missed-excluded list (recent form is a
 * real-performance metric — hypothetical "Missed" trades must not reach it).
 */
export function lastNChronological<T extends Pick<Trade, "id" | "datum_open">>(trades: T[], n: number): T[] {
  if (n <= 0) return [];
  return sortChronological(trades).slice(-n);
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

/** Only needs outcome + resultaat_pct — callers may pass a narrower column selection than a full ClosedTrade. */
export function computeOutcomeCounts(trades: Pick<ClosedTrade, "outcome" | "resultaat_pct">[]): OutcomeCounts {
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
export function computeStreaks(trades: ClosedTrade[]): StreakResult {
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
  /** Trade at the peak the max drawdown fell from. null when the drawdown ran from the 0-baseline start, or when there is no drawdown at all. */
  peakTradeId: string | null;
  /** Trade at the bottom of the max drawdown. null when there is no drawdown. */
  troughTradeId: string | null;
  /** Cumulative % at that peak (0 for the baseline / no-drawdown case). */
  peakCum: number;
  /** Cumulative % at that trough (0 when there is no drawdown). */
  troughCum: number;
}

/**
 * Rekenregel 4: largest pullback (%) from a running peak in the chronological
 * cumulative resultaat curve, across all fases combined, sorted by datum_open.
 * The peak starts at the 0-baseline (starting equity), so an opening losing
 * streak counts in full — it is not measured from its own first trade.
 * peak/trough identify the max drawdown itself, so equity-curve views can mark
 * the exact segment.
 */
export function computeMaxDrawdown(trades: ClosedTrade[]): DrawdownResult {
  const sorted = sortChronological(trades);

  let cum = 0;
  let runningPeak = 0;
  let runningPeakTradeId: string | null = null;
  let maxDrawdownPct = 0;
  let peakTradeId: string | null = null;
  let troughTradeId: string | null = null;
  let peakCum = 0;
  let troughCum = 0;

  for (const t of sorted) {
    cum += t.resultaat_pct;
    if (cum > runningPeak) {
      runningPeak = cum;
      runningPeakTradeId = t.id;
    }
    const dd = runningPeak - cum;
    if (dd > maxDrawdownPct) {
      maxDrawdownPct = dd;
      peakTradeId = runningPeakTradeId;
      troughTradeId = t.id;
      peakCum = runningPeak;
      troughCum = cum;
    }
  }

  return {
    maxDrawdownPct: round2(maxDrawdownPct),
    peakTradeId,
    troughTradeId,
    peakCum: round2(peakCum),
    troughCum: round2(troughCum),
  };
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
export function computeExpectancy(trades: ClosedTrade[]): ExpectancyResult {
  const winValues = trades.map((t) => t.resultaat_pct).filter((v) => v > 0);
  const lossValues = trades.map((t) => t.resultaat_pct).filter((v) => v < 0);

  const avgWin = winValues.length ? round2(mean(winValues)) : null;
  const avgLoss = lossValues.length ? round2(mean(lossValues)) : null;
  const winLossRatio = avgWin != null && avgLoss ? round2(Math.abs(avgWin / avgLoss)) : null;

  return { avgWin, avgLoss, winLossRatio };
}

export interface ProfitFactorResult {
  /** Sum of every positive resultaat_pct. */
  grossProfit: number;
  /** Absolute sum of every negative resultaat_pct (a positive number). */
  grossLoss: number;
  /**
   * Gross profit ÷ gross loss — how many units won per unit lost. `Infinity` when
   * there are winners but no losers (an unbounded edge, shown as "∞"); `null` when
   * neither winners nor losers exist yet (nothing decisive to divide — shown as
   * "—"). A BE trade (resultaat 0) contributes to neither side.
   */
  profitFactor: number | null;
}

/**
 * Profit factor: gross winning % over gross losing %. Sign of resultaat_pct
 * decides the side (matching computeExpectancy), so a "Win" logged at exactly 0%
 * lands on neither side. Callers pass an already-scoped, missed-excluded list.
 */
export function computeProfitFactor(trades: Pick<ClosedTrade, "resultaat_pct">[]): ProfitFactorResult {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const t of trades) {
    if (t.resultaat_pct > 0) grossProfit += t.resultaat_pct;
    else if (t.resultaat_pct < 0) grossLoss += -t.resultaat_pct;
  }
  const gp = round2(grossProfit);
  const gl = round2(grossLoss);
  let profitFactor: number | null;
  if (gl > 0) profitFactor = round2(gp / gl);
  else if (gp > 0) profitFactor = Infinity; // winners, no losers → unbounded
  else profitFactor = null; // nothing decisive yet
  return { grossProfit: gp, grossLoss: gl, profitFactor };
}

/**
 * Planned risk % for a trade — falls back to DEFAULT_RISK_PCT when risk_pct is
 * unset (null) or non-positive. This single guard is what makes R-multiples
 * non-intrusive: every legacy trade (risk_pct null) is treated as 1% risk, so
 * its R equals its resultaat_pct. Never divide by trade.risk_pct directly.
 */
export function riskPct(trade: Pick<Trade, "risk_pct">): number {
  return trade.risk_pct != null && trade.risk_pct > 0 ? trade.risk_pct : DEFAULT_RISK_PCT;
}

/**
 * R-multiple of a single trade: realised result relative to the planned risk it
 * was taken with (resultaat_pct / risk). Sign is preserved (a loss is negative
 * R). At the default 1% risk this is exactly resultaat_pct.
 */
export function rMultiple(trade: Pick<ClosedTrade, "resultaat_pct" | "risk_pct">): number {
  return round2(trade.resultaat_pct / riskPct(trade));
}

export interface RStats {
  /** Sum of every trade's R-multiple. */
  totalR: number;
  /** Mean R per trade — expectancy expressed in R. null when there are no trades. */
  avgR: number | null;
}

/**
 * Aggregate R-multiples across a set of trades. Callers pass an already-scoped,
 * missed-excluded list (same contract as computeOutcomeCounts) — R is a real
 * performance metric, so hypothetical "Missed" trades must not reach it.
 */
export function computeRStats(trades: Pick<ClosedTrade, "resultaat_pct" | "risk_pct">[]): RStats {
  const n = trades.length;
  if (n === 0) return { totalR: 0, avgR: null };
  // Sum the raw (unrounded) R-multiples, then round once — avoids compounding
  // per-trade rounding error into the total/average.
  const total = trades.reduce((s, t) => s + t.resultaat_pct / riskPct(t), 0);
  return { totalR: round2(total), avgR: round2(total / n) };
}

export interface RDistributionStats {
  /** Sample standard deviation (n−1) of the per-trade R-multiples. null with fewer than 2 trades. */
  stdDevR: number | null;
  /**
   * Van Tharp's System Quality Number: (avg R ÷ stdDev R) · √n. Expectancy
   * scaled by consistency — higher is a smoother, more tradable edge. null when
   * stdDevR is null or 0 (identical results carry no spread to quality-score).
   */
  sqn: number | null;
}

/**
 * Spread/quality of the R-multiple distribution. Same contract as
 * computeRStats: caller passes an already-scoped, missed-excluded closed list.
 */
export function computeRDistribution(trades: Pick<ClosedTrade, "resultaat_pct" | "risk_pct">[]): RDistributionStats {
  const n = trades.length;
  if (n < 2) return { stdDevR: null, sqn: null };
  const rs = trades.map((t) => t.resultaat_pct / riskPct(t));
  const avg = mean(rs);
  const variance = rs.reduce((s, r) => s + (r - avg) * (r - avg), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return { stdDevR: 0, sqn: null };
  return { stdDevR: round2(stdDev), sqn: round2((avg / stdDev) * Math.sqrt(n)) };
}

export interface ExtremesResult {
  /** Highest positive resultaat_pct. null when no trade is in profit. */
  largestWin: number | null;
  largestWinTradeId: string | null;
  /** Most negative resultaat_pct (kept negative). null when no trade is in loss. */
  largestLoss: number | null;
  largestLossTradeId: string | null;
}

/**
 * Largest single win and loss. Sign of resultaat_pct decides the side
 * (matching computeExpectancy/computeProfitFactor), so a 0% trade is neither.
 * Ties keep the chronologically earliest trade.
 */
export function computeExtremes(trades: Pick<ClosedTrade, "id" | "datum_open" | "resultaat_pct">[]): ExtremesResult {
  let win: { value: number; id: string } | null = null;
  let loss: { value: number; id: string } | null = null;
  for (const t of sortChronological(trades)) {
    if (t.resultaat_pct > 0 && (win == null || t.resultaat_pct > win.value)) {
      win = { value: t.resultaat_pct, id: t.id };
    } else if (t.resultaat_pct < 0 && (loss == null || t.resultaat_pct < loss.value)) {
      loss = { value: t.resultaat_pct, id: t.id };
    }
  }
  return {
    largestWin: win ? round2(win.value) : null,
    largestWinTradeId: win?.id ?? null,
    largestLoss: loss ? round2(loss.value) : null,
    largestLossTradeId: loss?.id ?? null,
  };
}

/**
 * Mean planned risk % per trade, through the same riskPct() fallback the
 * R-multiples use (null/non-positive risk_pct counts as DEFAULT_RISK_PCT, so
 * this always reflects what R was actually computed against). null when empty.
 */
export function computeAvgRiskPct(trades: Pick<Trade, "risk_pct">[]): number | null {
  if (trades.length === 0) return null;
  return round2(mean(trades.map(riskPct)));
}

export interface EquityPoint {
  idx: number;
  tradeId: string;
  datumOpen: string;
  cum: number;
}

/**
 * Cumulative equity curve, chronological by datum_open (id-tiebroken): the arithmetic
 * sum of resultaat_pct as a running % return from the start, matching every other
 * cumulative total in the app. Callers pass an already-scoped, missed-decided list
 * (Reviews deliberately plots missed rows here).
 */
export function computeEquityCurve(trades: ClosedTrade[]): EquityPoint[] {
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
  /** Win rate ignoring break-even trades: wins / (wins + losses). null when there are no decisive trades. */
  winRateExclBe: number | null;
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
  /** Gross profit ÷ gross loss; Infinity = no losers yet, null = nothing decisive. See computeProfitFactor. */
  profitFactor: number | null;
  maxDrawdownPct: number;
  totalR: number;
  avgR: number | null;
}

/**
 * Single entry point for the Overview KPI row — every view that needs these
 * numbers calls this instead of recomputing streaks/drawdown/expectancy itself.
 */
export function computeOverviewKpis(trades: ClosedTrade[]): OverviewKpis {
  const counts = computeOutcomeCounts(trades);
  const streaks = computeStreaks(trades);
  const drawdown = computeMaxDrawdown(trades);
  const expectancy = computeExpectancy(trades);
  const profitFactor = computeProfitFactor(trades);
  const rStats = computeRStats(trades);

  return {
    totalTrades: counts.n,
    totalResultaat: counts.resultaatTotal,
    winRate: counts.winRate,
    winRateExclBe: counts.wins + counts.losses > 0 ? counts.wins / (counts.wins + counts.losses) : null,
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
    profitFactor: profitFactor.profitFactor,
    maxDrawdownPct: drawdown.maxDrawdownPct,
    totalR: rStats.totalR,
    avgR: rStats.avgR,
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
export function computeErrorCounts(taken: Trade[], missed: ClosedTrade[]): ErrorCounts {
  return {
    emotional: taken.filter((t) => t.trade_evaluation === "Emotional error").length,
    technical: taken.filter((t) => t.trade_evaluation === "Technical error").length,
    missedCount: missed.length,
    missedResultaat: round2(missed.reduce((s, t) => s + t.resultaat_pct, 0)),
  };
}

export interface DisciplineStats {
  /** Taken trades carrying an execution grade (Good/Emotional/Technical). Ungraded taken trades are excluded — neither disciplined nor a lapse. */
  evaluated: number;
  good: number;
  emotional: number;
  technical: number;
  /** Share of graded trades marked "Good trade", 0..1. null when nothing is graded yet. */
  rate: number | null;
}

/**
 * Discipline = execution quality (trade_evaluation), independent of P&L. Only
 * graded taken trades count; "Missed trade" is hypothetical (caller passes an
 * already missed-excluded list) and an ungraded taken trade counts toward
 * neither the numerator nor the denominator.
 */
export function computeDisciplineStats(taken: Pick<Trade, "trade_evaluation">[]): DisciplineStats {
  const good = taken.filter((t) => t.trade_evaluation === "Good trade").length;
  const emotional = taken.filter((t) => t.trade_evaluation === "Emotional error").length;
  const technical = taken.filter((t) => t.trade_evaluation === "Technical error").length;
  const evaluated = good + emotional + technical;
  return { evaluated, good, emotional, technical, rate: evaluated ? good / evaluated : null };
}

export interface DisciplinePoint {
  /** 1-based index among graded taken trades (an ungraded trade produces no point). */
  idx: number;
  tradeId: string;
  datumOpen: string;
  /** Cumulative % of graded trades up to and including this one that were "Good trade" (0..100). */
  cumRate: number;
}

/**
 * Chronological discipline trend: the running share of "Good trade" among all
 * graded taken trades so far, one point per graded trade (sorted by datum_open,
 * tie-broken by id). Shows whether execution quality is trending up or down over
 * the sequence. Caller passes an already missed-excluded list (same contract as
 * the other real-performance helpers).
 */
export function computeDisciplineCurve(trades: Trade[]): DisciplinePoint[] {
  const graded = sortChronological(trades).filter(isGraded);
  let goodSoFar = 0;
  return graded.map((t, i) => {
    if (t.trade_evaluation === "Good trade") goodSoFar += 1;
    return { idx: i + 1, tradeId: t.id, datumOpen: t.datum_open, cumRate: round2((goodSoFar / (i + 1)) * 100) };
  });
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Rounds to 2 decimals, normalizing an exact-zero negative sum (-0) to 0 — Math.round(-0.001 * 100) / 100 is -0, which is falsy and renders as "-0%". */
export function round2(n: number): number {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}
