/**
 * Pure analytics over the owner's habit history (migration 0054). All functions
 * take a `DaysByDate` map (yyyy-mm-dd → the day's completed-habit bag) exactly as
 * `useHabits` exposes it, plus an explicit `today` (yyyy-mm-dd, local) so nothing
 * here reads the clock — that keeps every function deterministic and testable.
 *
 * Two tiers of habit (see src/lib/habits.ts):
 *  - daily  → a day either did it or didn't; adherence = done days / days.
 *  - weekly → a per-ISO-week target count; the week's progress is how many days
 *             in that week carry the key.
 *
 * The whole point of these views is to make the owner's "zig-zag" visible —
 * ~3 strong weeks then a week-4 collapse. The per-week summary is what surfaces it.
 */

import { DAILY_HABITS, WEEKLY_HABITS, isFloorMet, type HabitValues } from "@/lib/habits";
import { isoWeekOf, isoWeekRange } from "@/lib/isoWeek";
import { toLocalIso } from "@/lib/localDate";

export type DaysByDate = Map<string, HabitValues>;

/** Inclusive list of yyyy-mm-dd from `startIso` to `endIso`. Empty if start > end. */
export function isoDaysBetween(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  if (startIso > endIso) return out;
  const cur = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (cur <= end) {
    out.push(toLocalIso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** One habit's (or the floor's) completion over a window: done out of total, plus the ratio. */
export interface Adherence {
  key: string;
  done: number;
  total: number;
  /** done / total, or 0 when the window is empty. */
  rate: number;
}

function adherenceOver(days: DaysByDate, range: string[], predicate: (v: HabitValues | undefined) => boolean, key: string): Adherence {
  let done = 0;
  for (const iso of range) if (predicate(days.get(iso))) done += 1;
  return { key, done, total: range.length, rate: range.length ? done / range.length : 0 };
}

/** The window of the last `n` days ending at (and including) `today`. */
function lastNRange(today: string, n: number): string[] {
  const start = new Date(today + "T00:00:00");
  start.setDate(start.getDate() - (n - 1));
  return isoDaysBetween(toLocalIso(start), today);
}

/** Per daily-habit adherence over the last `n` days (inclusive of today). */
export function dailyAdherenceLastN(days: DaysByDate, today: string, n: number): Adherence[] {
  const range = lastNRange(today, n);
  return DAILY_HABITS.map((h) => adherenceOver(days, range, (v) => v?.[h.key] === true, h.key));
}

/** Floor (keystone + journal) adherence over the last `n` days. */
export function floorAdherenceLastN(days: DaysByDate, today: string, n: number): Adherence {
  return adherenceOver(days, lastNRange(today, n), (v) => isFloorMet(v), "floor");
}

/** Longest run of consecutive floor-met days within the last `n` days. */
export function bestFloorStreakLastN(days: DaysByDate, today: string, n: number): number {
  let best = 0;
  let cur = 0;
  for (const iso of lastNRange(today, n)) {
    if (isFloorMet(days.get(iso))) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

/** A single ISO week's summary — the backbone of the zig-zag view. */
export interface WeekSummary {
  jaar: number;
  week: number;
  startIso: string;
  endIso: string;
  /** Elapsed days in the week counted so far (≤ 7; a past week is 7, the current week is Mon→today). */
  daysCounted: number;
  floorDays: number;
  keystoneDays: number;
  /** Per weekly-target habit: how many days carried it, its target, and whether reached. */
  weekly: { key: string; count: number; target: number; reached: boolean }[];
}

function summarizeWeek(days: DaysByDate, jaar: number, week: number, today: string): WeekSummary {
  const { start, end } = isoWeekRange(jaar, week);
  // Never count into the future: cap the window at today.
  const cappedEnd = end < today ? end : today;
  const range = isoDaysBetween(start, cappedEnd);
  let floorDays = 0;
  let keystoneDays = 0;
  const weeklyCounts: Record<string, number> = {};
  for (const h of WEEKLY_HABITS) weeklyCounts[h.key] = 0;
  for (const iso of range) {
    const v = days.get(iso);
    if (isFloorMet(v)) floorDays += 1;
    if (v?.keystone === true) keystoneDays += 1;
    for (const h of WEEKLY_HABITS) if (v?.[h.key] === true) weeklyCounts[h.key] += 1;
  }
  return {
    jaar,
    week,
    startIso: start,
    endIso: end,
    daysCounted: range.length,
    floorDays,
    keystoneDays,
    weekly: WEEKLY_HABITS.map((h) => ({
      key: h.key,
      count: weeklyCounts[h.key],
      target: h.target ?? 0,
      reached: weeklyCounts[h.key] >= (h.target ?? 0),
    })),
  };
}

/** The last `numWeeks` ISO weeks up to and including `today`'s week, oldest → newest. */
export function recentWeekSummaries(days: DaysByDate, today: string, numWeeks: number): WeekSummary[] {
  const seen = new Set<string>();
  const weeks: { jaar: number; week: number }[] = [];
  const cursor = new Date(today + "T00:00:00");
  for (let i = 0; i < numWeeks; i += 1) {
    const { jaar, week_nummer } = isoWeekOf(toLocalIso(cursor));
    const key = `${jaar}-${week_nummer}`;
    if (!seen.has(key)) {
      seen.add(key);
      weeks.push({ jaar, week: week_nummer });
    }
    cursor.setDate(cursor.getDate() - 7);
  }
  weeks.reverse();
  return weeks.map(({ jaar, week }) => summarizeWeek(days, jaar, week, today));
}

/** A calendar month's summary (year + 0-based month), capped at `today`. */
export interface MonthSummary {
  year: number;
  /** 0-based month (0 = January), matching Date. */
  month: number;
  firstIso: string;
  /** Last day counted — the month's end, or today if the month is the current one. */
  lastCountedIso: string;
  daysCounted: number;
  floorDays: number;
  floor: Adherence;
  daily: Adherence[];
}

/** Summarize the calendar month containing (year, month), counting only up to `today`. */
export function monthSummary(days: DaysByDate, year: number, month: number, today: string): MonthSummary {
  const firstIso = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastOfMonth = new Date(year, month + 1, 0); // day 0 of next month = last day of this one
  const lastIso = toLocalIso(lastOfMonth);
  const lastCountedIso = lastIso < today ? lastIso : today;
  const range = firstIso > today ? [] : isoDaysBetween(firstIso, lastCountedIso);
  const floor = adherenceOver(days, range, (v) => isFloorMet(v), "floor");
  return {
    year,
    month,
    firstIso,
    lastCountedIso,
    daysCounted: range.length,
    floorDays: floor.done,
    floor,
    daily: DAILY_HABITS.map((h) => adherenceOver(days, range, (v) => v?.[h.key] === true, h.key)),
  };
}
