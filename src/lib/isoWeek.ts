function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Handelsweek-grens (owner-besluit 2026-09-30): een zondag-trade die om of na
 * dit tijdstip opent (Asia-/futures-open) hoort bij de week van de maandag
 * erna. Eén constante, gespiegeld in SQL door trading_date_of() (0063) — de
 * twee moeten in sync blijven.
 */
export const SUNDAY_ROLLOVER = "22:00";

/**
 * The date whose ISO week a trade belongs to for everything week-based (weekly
 * review, week grouping, "Deze week", calendar week totals): Sunday >= 22:00
 * rolls to the Monday after, everything else is just datum_open. tijd_open is
 * naive profile-local time (0051), so no timezone conversion; a Sunday trade
 * WITHOUT a time stays in the old week (deliberate owner choice). Accepts both
 * "HH:MM" and the DB's "HH:MM:SS" — string compare against "22:00" covers both.
 */
export function tradingDateOf(datumOpen: string, tijdOpen: string | null | undefined): string {
  if (tijdOpen == null || tijdOpen < SUNDAY_ROLLOVER) return datumOpen;
  const d = new Date(datumOpen + "T00:00:00Z");
  if (d.getUTCDay() !== 0) return datumOpen; // not a Sunday
  d.setUTCDate(d.getUTCDate() + 1);
  return toIsoDate(d);
}

/** ISO year/week of the trading week a trade belongs to — isoWeekOf over tradingDateOf, incl. the year rollover (Sunday 22:00 in week 52/53 → week 1 of the next ISO year). */
export function tradingWeekOf(datumOpen: string, tijdOpen: string | null | undefined): { jaar: number; week_nummer: number } {
  return isoWeekOf(tradingDateOf(datumOpen, tijdOpen));
}

/** Monday-Sunday date range (ISO 8601 week) for a given ISO year/week. */
export function isoWeekRange(jaar: number, weekNummer: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(jaar, 0, 4));
  const jan4DayMon = (jan4.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayMon);

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (weekNummer - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Number of ISO weeks in a year: 52 or 53. December 28 always falls in the year's last ISO week. */
export function weeksInIsoYear(jaar: number): number {
  return isoWeekOf(`${jaar}-12-28`).week_nummer;
}

/** ISO year/week for a given yyyy-mm-dd date string. */
export function isoWeekOf(dateIso: string): { jaar: number; week_nummer: number } {
  const d = new Date(dateIso + "T00:00:00Z");
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.valueOf() - firstThursday.valueOf();
  const week_nummer = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  return { jaar: target.getUTCFullYear(), week_nummer };
}
