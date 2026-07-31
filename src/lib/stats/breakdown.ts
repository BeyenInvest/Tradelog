import type { Trade } from "../types";
import { FASES, MIN_SAMPLE_SIZE, QUARTERS, WEEKDAYS, type Fase, type Quarter, type Weekday } from "../constants";
import { round2 } from "./core";

export interface BreakdownRow<K extends string> {
  key: K;
  label: string;
  n: number;
  resultaatTotal: number;
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
 * The one function every "Per X" split calls. `keyFn` returns:
 *  - a single key -> trade counts toward that bucket
 *  - an array of keys -> trade counts toward every bucket (e.g. Per Currency:
 *    one pair contributes to both its currencies)
 *  - null -> trade excluded from this breakdown entirely
 */
export function breakdownBy<K extends string>(
  trades: Trade[],
  keyFn: (t: Trade) => K | K[] | null,
  opts: BreakdownOpts<K> = {}
): BreakdownRow<K>[] {
  const minSample = opts.minSample ?? MIN_SAMPLE_SIZE;
  const groups = new Map<K, Trade[]>();
  const order: K[] = [];

  for (const t of trades) {
    const result = keyFn(t);
    if (result == null) continue;
    const keys = Array.isArray(result) ? result : [result];
    for (const key of keys) {
      let bucket = groups.get(key);
      if (!bucket) {
        bucket = [];
        groups.set(key, bucket);
        order.push(key);
      }
      bucket.push(t);
    }
  }

  const orderedKeys = opts.sortOrder
    ? [...order].sort((a, b) => {
        const ia = opts.sortOrder!.indexOf(a);
        const ib = opts.sortOrder!.indexOf(b);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      })
    : order;

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
  trades: Trade[],
  keyFn: (t: Trade) => K | K[] | null,
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
export function breakdownByFaseKenmerk(trades: Trade[], config: FaseKenmerkConfigLike, opts: BreakdownOpts<string> = {}) {
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
