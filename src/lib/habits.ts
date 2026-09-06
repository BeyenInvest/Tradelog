/**
 * Habit definitions for the owner's "90-Day Run" (owner-only tracker, migration
 * 0054). Hardcoded for v1 — this is the owner's personal list, not a
 * user-configurable feature. Two tiers:
 *
 *  - `daily`  — a checkbox each day. Done or not.
 *  - `weekly` — a per-ISO-week target count; ticked on the days they happen.
 *               The week's progress is how many days in the current ISO week
 *               carry that key in their `values` bag.
 *
 * The Dutch labels live in i18n (`habits.def.<key>`); the constants here hold
 * only the key + meta so the page and i18n stay in sync by key. The `label`
 * field is a plain-Dutch fallback used if a translation is ever missing.
 *
 * FLOOR rule: a day "staat" (counts, feeds the streak) when BOTH `keystone` AND
 * `journal` are done that day. That's the non-negotiable minimum.
 */

export type HabitTier = "daily" | "weekly";

export interface HabitDef {
  /** Stable key stored in habit_days.values and used as the i18n suffix. */
  key: string;
  /** i18n key for the label — `habits.def.<key>`. */
  labelKey: string;
  /** Plain-Dutch fallback label (used only if the translation is missing). */
  label: string;
  tier: HabitTier;
  /** Weekly target count (only for tier === "weekly"). */
  target?: number;
}

/** The daily habits — a checkbox each day. Order = display order. */
export const DAILY_HABITS: readonly HabitDef[] = [
  { key: "keystone", labelKey: "habits.def.keystone", label: "Keystone: alleen geplande trades, geen FOMO", tier: "daily" },
  { key: "journal", labelKey: "habits.def.journal", label: "Daily journal", tier: "daily" },
  { key: "zoon", labelKey: "habits.def.zoon", label: "30 min no-phone met mijn zoon", tier: "daily" },
  { key: "verklaren", labelKey: "habits.def.verklaren", label: "Mezelf verklaren", tier: "daily" },
  { key: "water", labelKey: "habits.def.water", label: "Enkel water (weekdagen)", tier: "daily" },
  { key: "stappen", labelKey: "habits.def.stappen", label: "10.000 stappen", tier: "daily" },
] as const;

/** The weekly-target habits — ticked on the days they happen, counted per ISO week. */
export const WEEKLY_HABITS: readonly HabitDef[] = [
  { key: "sport", labelKey: "habits.def.sport", label: "Sporten", tier: "weekly", target: 3 },
  { key: "backtest", labelKey: "habits.def.backtest", label: "Backtesten", tier: "weekly", target: 4 },
  { key: "vriendin", labelKey: "habits.def.vriendin", label: "Intentionele avond met mijn partner", tier: "weekly", target: 1 },
  { key: "mama", labelKey: "habits.def.mama", label: "Mama bellen", tier: "weekly", target: 1 },
] as const;

/** Every habit, both tiers. */
export const ALL_HABITS: readonly HabitDef[] = [...DAILY_HABITS, ...WEEKLY_HABITS];

/** The keys whose completion defines the daily FLOOR (both required). */
export const FLOOR_KEYS = ["keystone", "journal"] as const;

/** The shape of the per-day `values` jsonb bag: `{ [habitKey]: true }`. */
export type HabitValues = Record<string, boolean>;

/** A day "staat" when every FLOOR key is done that day. */
export function isFloorMet(values: HabitValues | undefined): boolean {
  if (!values) return false;
  return FLOOR_KEYS.every((k) => values[k] === true);
}
