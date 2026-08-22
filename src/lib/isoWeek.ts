function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
