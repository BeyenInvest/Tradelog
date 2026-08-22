/**
 * yyyy-mm-dd in the *local* timezone. `toISOString().slice(0, 10)` is UTC: for
 * CET/CEST (ahead of UTC) it turns any local Date before 01:00/02:00 — and
 * "now" right after local midnight — into yesterday.
 */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Today as yyyy-mm-dd in the user's local timezone. Call at use time, never at
 * module load — a PWA tab can stay open for days, freezing a module-level
 * "today" on its first render (M2).
 */
export function localTodayIso(): string {
  return toLocalIso(new Date());
}
