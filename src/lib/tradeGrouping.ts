import type { Trade } from "./types";
import { MONTH_NAMES, type Outcome } from "./constants";
import { isMissed, round2 } from "./stats/core";

export type GroupBy = "month" | "week" | "quarter" | "backtestDag";

export interface TradeGroup {
  key: string;
  label: string;
  trades: Trade[];
  resultaatTotal: number;
}

/** Missed trades are hypothetical and must never count toward a group's real resultaat total, even though they still appear in `trades` for display when a caller chooses to include them. */
function realResultaatTotal(trades: Trade[]): number {
  return round2(trades.reduce((s, t) => (isMissed(t) ? s : s + t.resultaat_pct), 0));
}

function monthKey(dateIso: string): { key: string; label: string } {
  const [y, m] = dateIso.split("-");
  return { key: `${y}-${m}`, label: `${MONTH_NAMES[Number(m) - 1]} ${y}` };
}

function quarterKey(dateIso: string): { key: string; label: string } {
  const [y, m] = dateIso.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return { key: `${y}-Q${q}`, label: `Q${q} ${y}` };
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

/** Calendar day (local time) a trade was actually entered — i.e. the real-life backtesting session it was logged in, as opposed to `datum_open` which is the historical date the trade happened on the chart. */
function backtestDagKey(createdAtIso: string): { key: string; label: string } {
  const date = new Date(createdAtIso);
  return {
    key: date.toLocaleDateString("sv-SE"), // yyyy-mm-dd in local time
    label: date.toLocaleDateString("nl-BE", { day: "2-digit", month: "long", year: "numeric" }),
  };
}

/** Groups trades by month, quarter, or ISO week (all keyed on `datum_open`, the historical trade date), or by backtest session day (keyed on `created_at`, the day the trade was actually logged) — input order is preserved per bucket (pass already-sorted trades in). */
export function groupTrades(trades: Trade[], groupBy: GroupBy): TradeGroup[] {
  const keyFn =
    groupBy === "backtestDag"
      ? (t: Trade) => backtestDagKey(t.created_at)
      : groupBy === "month"
        ? (t: Trade) => monthKey(t.datum_open)
        : groupBy === "quarter"
          ? (t: Trade) => quarterKey(t.datum_open)
          : (t: Trade) => weekKey(t.datum_open);
  const buckets = new Map<string, Trade[]>();
  const labels = new Map<string, string>();
  const order: string[] = [];

  for (const t of trades) {
    const { key, label } = keyFn(t);
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
      resultaatTotal: realResultaatTotal(bucketTrades),
    };
  });
}

const OUTCOME_ORDER: Outcome[] = ["Win", "BE", "Loss"];

/** Groups trades into fixed Win/BE/Loss buckets (always all three, even empty) — order matches the rest of the review UI (pie chart legend, outcome counts). */
export function groupTradesByOutcome(trades: Trade[]): TradeGroup[] {
  return OUTCOME_ORDER.map((outcome) => {
    const bucketTrades = trades.filter((t) => t.outcome === outcome);
    return {
      key: outcome,
      label: outcome,
      trades: bucketTrades,
      resultaatTotal: realResultaatTotal(bucketTrades),
    };
  });
}

/** Free-text search across the fields a trader would actually search on. */
export function matchesSearch(t: Trade, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.pair, t.fase, t.trade_concept, t.entry, t.notes].some((v) => v != null && v.toLowerCase().includes(q));
}
