import type { Trade } from "./types";
import { MONTH_NAMES } from "./constants";

export type GroupBy = "month" | "week";

export interface TradeGroup {
  key: string;
  label: string;
  trades: Trade[];
  resultaatTotal: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthKey(dateIso: string): { key: string; label: string } {
  const [y, m] = dateIso.split("-");
  return { key: `${y}-${m}`, label: `${MONTH_NAMES[Number(m) - 1]} ${y}` };
}

/** ISO 8601 week (Monday-first, week 1 = the week containing the year's first Thursday). */
function weekKey(dateIso: string): { key: string; label: string } {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7)); // shift to this week's Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { key: `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`, label: `Week ${week} · ${date.getUTCFullYear()}` };
}

/** Groups trades by month or ISO week — input order is preserved per bucket (pass already-sorted trades in). */
export function groupTrades(trades: Trade[], groupBy: GroupBy): TradeGroup[] {
  const keyFn = groupBy === "month" ? monthKey : weekKey;
  const buckets = new Map<string, Trade[]>();
  const labels = new Map<string, string>();
  const order: string[] = [];

  for (const t of trades) {
    const { key, label } = keyFn(t.datum_open);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      labels.set(key, label);
      order.push(key);
    }
    bucket.push(t);
  }

  return order.map((key) => {
    const bucketTrades = buckets.get(key)!;
    return {
      key,
      label: labels.get(key)!,
      trades: bucketTrades,
      resultaatTotal: round2(bucketTrades.reduce((s, t) => s + t.resultaat_pct, 0)),
    };
  });
}

/** Free-text search across the fields a trader would actually search on. */
export function matchesSearch(t: Trade, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.pair, t.fase, t.trade_concept, t.entry, t.notes].some((v) => v != null && v.toLowerCase().includes(q));
}
