/**
 * Habit helpers. Since migration 0056 the habit *definitions* are user-owned rows
 * (the `Habit` type in src/lib/types.ts, loaded by useHabits) rather than a
 * hardcoded list — so this module only holds the per-day values shape and the
 * floor rule, both parameterised by the user's own habit keys.
 */

/** The shape of the per-day `values` jsonb bag: `{ [habitKey]: true }`. */
export type HabitValues = Record<string, boolean>;

/**
 * A day meets its FLOOR when every non-negotiable (floor) habit is done that day.
 * Floor keys are the `key`s of the user's habits flagged `is_floor`. With no floor
 * habits defined the concept doesn't apply — returns false so a blank day is never
 * counted as "met" (and the streak stays at zero until the user marks a floor).
 */
export function isFloorMet(values: HabitValues | undefined, floorKeys: readonly string[]): boolean {
  if (!values || floorKeys.length === 0) return false;
  return floorKeys.every((k) => values[k] === true);
}
