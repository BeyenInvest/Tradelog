import { type PeriodType } from "./constants";
import { monthName } from "./format";

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface DateRange {
  start: string;
  end: string;
}

/** Calendar month range (1-12), e.g. (2026, 7) → 2026-07-01..2026-07-31. */
export function monthRange(jaar: number, maand: number): DateRange {
  const start = new Date(Date.UTC(jaar, maand - 1, 1));
  const end = new Date(Date.UTC(jaar, maand, 0)); // day 0 of next month = last day of this month
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Calendar quarter range (1-4), e.g. (2026, 3) → 2026-07-01..2026-09-30. */
export function quarterRange(jaar: number, kwartaal: number): DateRange {
  const startMonth = (kwartaal - 1) * 3 + 1;
  const start = new Date(Date.UTC(jaar, startMonth - 1, 1));
  const end = new Date(Date.UTC(jaar, startMonth + 2, 0));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Calendar year range, e.g. 2026 → 2026-01-01..2026-12-31. */
export function yearRange(jaar: number): DateRange {
  return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
}

export function rangeOfPeriod(periodType: PeriodType, jaar: number, periodeNummer: number | null): DateRange {
  if (periodType === "month") return monthRange(jaar, periodeNummer!);
  if (periodType === "quarter") return quarterRange(jaar, periodeNummer!);
  return yearRange(jaar);
}

/** Human label for a period, e.g. "July 2026", "Q3 2026", "2026". `locale` (BCP47, from dateLocale(i18n.language)) drives the localized month name. */
export function periodLabel(periodType: PeriodType, jaar: number, periodeNummer: number | null, locale = "en-GB"): string {
  if (periodType === "month") return `${monthName((periodeNummer ?? 1) - 1, locale)} ${jaar}`;
  if (periodType === "quarter") return `Q${periodeNummer} ${jaar}`;
  return `${jaar}`;
}
