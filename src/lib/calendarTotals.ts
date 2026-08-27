import { round2, type ClosedTrade } from "@/lib/stats";
import { resultInUnit } from "@/lib/format";
import { isoWeekOf } from "@/lib/isoWeek";
import { toLocalIso } from "@/lib/localDate";
import type { ResultUnit } from "@/lib/constants";

/**
 * De kalender-totaallogica van CalendarView als pure, geteste functies (audit
 * T1): maandraster, dag-/week-/maandtotalen en het ISO-weeknummer per rij.
 * `month` is overal 0-based (zoals Date#getMonth), de dagen in het raster
 * 1-based; `null`-cellen zijn padding buiten de maand.
 */

/** Monday-first weekday offset of the month's first day (0 = the month starts on a Monday). */
export function mondayFirstOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Full weeks (rows of exactly 7 cells, null = padding) for the Monday-first
 * month grid: leading pad for the first weekday offset, trailing pad to
 * complete the last week — so every row can carry a leading week-total cell.
 */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const startOffset = mondayFirstOffset(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const out: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
  return out;
}

/**
 * Buckets trades onto their day-of-month; trades outside (year, month) are
 * dropped. Pure string comparison on the yyyy-mm-dd datum_open — no Date
 * parsing, so no timezone can shift a trade into a neighbouring day.
 */
export function tradesByDayOfMonth<T extends { datum_open: string }>(
  trades: T[],
  year: number,
  month: number
): Map<number, T[]> {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const m = new Map<number, T[]>();
  for (const t of trades) {
    if (!t.datum_open.startsWith(prefix)) continue;
    const day = Number(t.datum_open.slice(8, 10));
    const bucket = m.get(day) ?? [];
    bucket.push(t);
    m.set(day, bucket);
  }
  return m;
}

/**
 * Realized day totals in the chosen unit, round2'd (CLAUDE.md-invariant: the
 * win/loss cell color and the aggregates may never read float dust like
 * -2.8e-17). The single source for cell values, week rows and the month total.
 */
export function dayTotalsInUnit(
  byDay: Map<number, Pick<ClosedTrade, "resultaat_pct" | "risk_pct">[]>,
  unit: ResultUnit,
  saldo?: number | null
): Map<number, number> {
  const m = new Map<number, number>();
  for (const [day, dayTrades] of byDay) {
    m.set(day, round2(dayTrades.reduce((s, t) => s + resultInUnit(t, unit, saldo), 0)));
  }
  return m;
}

/** Month total: the sum of the (already rounded) day totals, round2'd again. */
export function monthTotalOf(dayTotals: Map<number, number>): number {
  let sum = 0;
  for (const v of dayTotals.values()) sum += v;
  return round2(sum);
}

/** Week-row total + whether any day in the row carries a realized result (an all-empty row renders no total). */
export function weekTotalOf(
  week: (number | null)[],
  dayTotals: Map<number, number>
): { total: number; hasResult: boolean } {
  const total = round2(week.reduce<number>((s, d) => s + (d != null ? dayTotals.get(d) ?? 0 : 0), 0));
  const hasResult = week.some((d) => d != null && dayTotals.has(d));
  return { total, hasResult };
}

/**
 * ISO week number of grid row `weekIndex`, read from that row's Monday — which
 * may spill into the neighbouring month, which is exactly what the ISO week
 * should reflect (week 53/jaarwissel included, via isoWeekOf).
 */
export function rowWeekNumber(year: number, month: number, weekIndex: number): number {
  const startOffset = mondayFirstOffset(year, month);
  const monday = new Date(year, month, 1 - startOffset + weekIndex * 7);
  return isoWeekOf(toLocalIso(monday)).week_nummer;
}
