import type { Trade } from "../types";
import { FASES, MIN_SAMPLE_SIZE, QUARTERS, WEEKDAYS, type Fase, type Quarter, type Weekday } from "../constants";
import { round2, rMultiple, type ClosedTrade } from "./core";

export interface BreakdownRow<K extends string> {
  key: K;
  label: string;
  n: number;
  resultaatTotal: number;
  wins: number;
  be: number;
  losses: number;
  winRate: number;
  beRate: number;
  lossRate: number;
  isLowSample: boolean;
}

export interface BreakdownOpts<K extends string> {
  labelFn?: (key: K) => string;
  minSample?: number;
  /** When set, rows are ordered to match this list (e.g. FASES) instead of first-seen-in-data order. Keys not present in the list keep their relative insertion order, appended after. */
  sortOrder?: readonly K[];
}

/**
 * Shared grouping primitive: buckets trades by `keyFn`, preserving first-seen
 * insertion order (Map iteration order). `keyFn` returns:
 *  - a single key -> trade counts toward that bucket
 *  - an array of keys -> trade counts toward every bucket (e.g. Per Currency:
 *    one pair contributes to both its currencies)
 *  - null -> trade excluded from this grouping entirely
 * Both breakdownBy and computeConditionGaps (adherence.ts) build on this, so
 * the keyFn contract has exactly one owner.
 */
export function groupByKey<T, K extends string>(trades: T[], keyFn: (t: T) => K | K[] | null): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const t of trades) {
    const result = keyFn(t);
    if (result == null) continue;
    const keys = Array.isArray(result) ? result : [result];
    for (const key of keys) {
      let bucket = groups.get(key);
      if (!bucket) {
        bucket = [];
        groups.set(key, bucket);
      }
      bucket.push(t);
    }
  }
  return groups;
}

/**
 * Orders bucket keys by an optional fixed list (e.g. FASES/SESSIES): keys present
 * in `sortOrder` follow its order; keys absent from it keep their relative
 * first-seen order, appended after. Shared by breakdownBy and computeCrossTable so
 * both rows and matrix axes order identically.
 */
export function orderKeys<K extends string>(keys: K[], sortOrder?: readonly K[]): K[] {
  if (!sortOrder) return keys;
  return [...keys].sort((a, b) => {
    const ia = sortOrder.indexOf(a);
    const ib = sortOrder.indexOf(b);
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

/** The one function every "Per X" split calls — groupByKey plus the standard outcome/resultaat aggregates per bucket. */
export function breakdownBy<K extends string>(
  trades: ClosedTrade[],
  keyFn: (t: ClosedTrade) => K | K[] | null,
  opts: BreakdownOpts<K> = {}
): BreakdownRow<K>[] {
  const minSample = opts.minSample ?? MIN_SAMPLE_SIZE;
  const groups = groupByKey(trades, keyFn);
  const orderedKeys = orderKeys([...groups.keys()], opts.sortOrder);

  return orderedKeys.map((key) => {
    const bucket = groups.get(key)!;
    const n = bucket.length;
    const wins = bucket.filter((t) => t.outcome === "Win").length;
    const losses = bucket.filter((t) => t.outcome === "Loss").length;
    const be = bucket.filter((t) => t.outcome === "BE").length;
    return {
      key,
      label: opts.labelFn ? opts.labelFn(key) : key,
      n,
      resultaatTotal: round2(bucket.reduce((s, t) => s + t.resultaat_pct, 0)),
      wins,
      be,
      losses,
      winRate: n ? wins / n : 0,
      beRate: n ? be / n : 0,
      lossRate: n ? losses / n : 0,
      isLowSample: n < minSample,
    };
  });
}

export interface BreakdownRowWithFaseSplit<K extends string> extends BreakdownRow<K> {
  byFase: Record<Fase, { n: number; resultaatTotal: number; winRate: number; isLowSample: boolean }>;
}

/**
 * "Per Fase-opsplitsing": reuses breakdownBy on the full set, then again per
 * fase, and merges by key — no separate aggregation logic.
 */
export function breakdownByWithFaseSplit<K extends string>(
  trades: ClosedTrade[],
  keyFn: (t: ClosedTrade) => K | K[] | null,
  opts: BreakdownOpts<K> = {}
): BreakdownRowWithFaseSplit<K>[] {
  const overall = breakdownBy(trades, keyFn, opts);
  const perFase = new Map<Fase, BreakdownRow<K>[]>();
  for (const fase of FASES) {
    perFase.set(fase, breakdownBy(trades.filter((t) => t.fase === fase), keyFn, opts));
  }

  return overall.map((row) => {
    const byFase = {} as BreakdownRowWithFaseSplit<K>["byFase"];
    for (const fase of FASES) {
      const match = perFase.get(fase)!.find((r) => r.key === row.key);
      byFase[fase] = match
        ? { n: match.n, resultaatTotal: match.resultaatTotal, winRate: match.winRate, isLowSample: match.isLowSample }
        : { n: 0, resultaatTotal: 0, winRate: 0, isLowSample: true };
    }
    return { ...row, byFase };
  });
}

export interface FaseKenmerkConfigLike {
  fase: Fase;
  field: string;
  values: "boolean" | readonly string[];
}

/**
 * Fase-conditional kenmerk breakdown, driven by FASE_KENMERKEN config
 * (src/lib/constants.ts) — filters to the config's fase, maps the field to a
 * display value, then delegates to breakdownBy.
 */
export function breakdownByFaseKenmerk(trades: ClosedTrade[], config: FaseKenmerkConfigLike, opts: BreakdownOpts<string> = {}) {
  const scoped = trades.filter((t) => t.fase === config.fase);
  return breakdownBy(
    scoped,
    (t) => {
      const raw = (t as unknown as Record<string, unknown>)[config.field];
      if (raw == null) return null;
      if (config.values === "boolean") return raw ? "Ja" : "Nee";
      return String(raw);
    },
    opts
  );
}

export interface RHistogramBin {
  /** Short x-axis label for the bin — "+2R", "-1R", "0R", or the overflow "≥ 6R" / "≤ -6R". */
  key: string;
  /** How many trades fell in this bin. */
  n: number;
  /** The bin's representative whole-R value (rounded; the clamp bound for overflow bins). Its sign colours the bar. */
  bin: number;
}

/** Outermost bins are overflow, so one big winner/loser can't stretch the axis into a wall of empty bars. */
const R_HISTOGRAM_CAP = 6;

function rBinLabel(bin: number): string {
  if (bin >= R_HISTOGRAM_CAP) return `≥ ${bin}R`;
  if (bin <= -R_HISTOGRAM_CAP) return `≤ ${bin}R`;
  return `${bin > 0 ? "+" : ""}${bin}R`;
}

/**
 * R-multiple distribution as a histogram: each trade's rMultiple() is put in a
 * fixed 1R-wide bin, rounded to the nearest whole R — so each bar counts the trades
 * that made ≈ that many R (a full stop-out ≈ -1R, a 2R winner ≈ +2R, scratches ≈ 0R).
 * Bins run contiguously from the lowest to the highest occupied R (empty bins in
 * between are kept, so gaps in the distribution show), with the extremes folded into
 * a ±CAP overflow bin. Same contract as computeRStats: caller passes an
 * already-scoped, missed-excluded closed list. Returns [] when empty.
 */
export function computeRHistogram(trades: Pick<ClosedTrade, "resultaat_pct" | "risk_pct">[]): RHistogramBin[] {
  if (trades.length === 0) return [];
  const binOf = (r: number) => Math.max(-R_HISTOGRAM_CAP, Math.min(R_HISTOGRAM_CAP, Math.round(r)));
  const counts = new Map<number, number>();
  for (const t of trades) {
    const b = binOf(rMultiple(t));
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const lo = Math.min(...counts.keys());
  const hi = Math.max(...counts.keys());
  const bins: RHistogramBin[] = [];
  for (let b = lo; b <= hi; b++) bins.push({ bin: b, n: counts.get(b) ?? 0, key: rBinLabel(b) });
  return bins;
}

export interface CrossTableCell {
  n: number;
  resultaatTotal: number;
  /** Wins / n, 0..1. */
  winRate: number;
  isLowSample: boolean;
}

export interface CrossTableResult {
  /** Row keys in display order (row dimension's sortOrder, else first-seen). */
  rowKeys: string[];
  /** Column keys in display order. */
  colKeys: string[];
  /** rowKey → colKey → cell. Only non-empty cells are present (use getCell for a safe lookup). */
  cells: Map<string, Map<string, CrossTableCell>>;
  /** Per-row aggregate across the whole matrix universe (each trade counted once per row key). */
  rowTotals: Map<string, CrossTableCell>;
  colTotals: Map<string, CrossTableCell>;
  /** Aggregate of every trade that has both a row key and a column key. */
  grandTotal: CrossTableCell;
}

/** Null-safe cell lookup for a CrossTableResult (missing = empty combination). */
export function getCell(table: CrossTableResult, rowKey: string, colKey: string): CrossTableCell | null {
  return table.cells.get(rowKey)?.get(colKey) ?? null;
}

const CROSS_SEP = " ";

function aggregateCell(bucket: Pick<ClosedTrade, "outcome" | "resultaat_pct">[], minSample: number): CrossTableCell {
  const n = bucket.length;
  const wins = bucket.filter((t) => t.outcome === "Win").length;
  return {
    n,
    resultaatTotal: round2(bucket.reduce((s, t) => s + t.resultaat_pct, 0)),
    winRate: n ? wins / n : 0,
    isLowSample: n < minSample,
  };
}

/**
 * Cross-tabulation of two "Per X" dimensions (setup × sessie, instrument × uur, …):
 * every trade is placed in the cell(s) for its (rowKey, colKey) combination, reusing
 * each dimension's own keyFn straight from the DimensionConfig list — the keyFn
 * contract is honoured verbatim (null in either axis drops the trade from the whole
 * table; an array key, e.g. Per Currency, spreads the trade across each combination).
 * Built on the shared groupByKey primitive, so no dimension logic or filtering is
 * re-implemented here. Row/column totals are aggregated over the matrix universe
 * (trades with both keys present) counting each trade once per key, so for a
 * single-key dimension the cells reconcile with the totals; a multi-key dimension
 * (currency) intentionally counts a trade in each key it belongs to, as its plain
 * breakdown already does. Caller passes an already-scoped, missed-excluded closed
 * list — already in the active result unit when the cells should display converted.
 */
export function computeCrossTable(
  trades: ClosedTrade[],
  rowKeyFn: (t: ClosedTrade) => string | string[] | null,
  colKeyFn: (t: ClosedTrade) => string | string[] | null,
  opts: { rowOrder?: readonly string[]; colOrder?: readonly string[]; minSample?: number } = {}
): CrossTableResult {
  const minSample = opts.minSample ?? MIN_SAMPLE_SIZE;
  const norm = (r: string | string[] | null): string[] => (r == null ? [] : Array.isArray(r) ? r : [r]);

  // The matrix universe: only trades that have BOTH a row key and a column key.
  // Restricting here (not re-deriving any dimension logic) keeps grand/row/col
  // totals consistent with the cells the user sees.
  const universe = trades.filter((t) => norm(rowKeyFn(t)).length > 0 && norm(colKeyFn(t)).length > 0);

  // Cells: one groupByKey over the cartesian (row × col) product per trade, using
  // the exact array/null semantics of groupByKey via a composed pair keyFn.
  const cellGroups = groupByKey(universe, (t) => {
    const pairs: string[] = [];
    for (const r of norm(rowKeyFn(t))) for (const c of norm(colKeyFn(t))) pairs.push(r + CROSS_SEP + c);
    return pairs;
  });

  const rowKeySet = new Set<string>();
  const colKeySet = new Set<string>();
  const cells = new Map<string, Map<string, CrossTableCell>>();
  for (const [pair, bucket] of cellGroups) {
    const [rowKey, colKey] = pair.split(CROSS_SEP);
    rowKeySet.add(rowKey);
    colKeySet.add(colKey);
    let row = cells.get(rowKey);
    if (!row) {
      row = new Map();
      cells.set(rowKey, row);
    }
    row.set(colKey, aggregateCell(bucket, minSample));
  }

  const rowKeys = orderKeys([...rowKeySet], opts.rowOrder);
  const colKeys = orderKeys([...colKeySet], opts.colOrder);

  const rowTotals = new Map<string, CrossTableCell>();
  for (const [key, bucket] of groupByKey(universe, rowKeyFn)) rowTotals.set(key, aggregateCell(bucket, minSample));
  const colTotals = new Map<string, CrossTableCell>();
  for (const [key, bucket] of groupByKey(universe, colKeyFn)) colTotals.set(key, aggregateCell(bucket, minSample));

  return { rowKeys, colKeys, cells, rowTotals, colTotals, grandTotal: aggregateCell(universe, minSample) };
}

const WEEKDAY_INDEX: Weekday[] = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/** Weekday of datum_open, Monday-first to match the calendar view. */
export function weekdayKey(t: Trade): Weekday {
  const jsDay = new Date(t.datum_open + "T00:00:00").getDay(); // 0=Sun..6=Sat
  const mondayFirst = (jsDay + 6) % 7; // 0=Mon..6=Sun
  return WEEKDAY_INDEX[mondayFirst];
}

/** Quarter of datum_open. */
export function quarterKey(t: Trade): Quarter {
  const month = Number(t.datum_open.slice(5, 7)); // 1-12
  return QUARTERS[Math.floor((month - 1) / 3)];
}

export { WEEKDAYS, QUARTERS };
