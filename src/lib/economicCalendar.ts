export type EconomicImpact = "Low" | "Medium" | "High" | "Holiday";

/** Mirrors the (unofficial) ForexFactory calendar feed's JSON shape. */
export interface EconomicEvent {
  title: string;
  country: string;
  date: string; // ISO datetime with UTC offset, e.g. "2026-07-27T08:30:00-04:00"
  impact: EconomicImpact;
  forecast: string;
  previous: string;
}

export interface EconomicEventGroup {
  dateKey: string; // yyyy-mm-dd in the browser's local timezone
  events: EconomicEvent[];
}

/** Groups events by local calendar day, sorted chronologically within each day. */
export function groupEventsByDay(events: EconomicEvent[]): EconomicEventGroup[] {
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const groups = new Map<string, EconomicEvent[]>();

  for (const event of sorted) {
    const d = new Date(event.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const bucket = groups.get(dateKey) ?? [];
    bucket.push(event);
    groups.set(dateKey, bucket);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, events]) => ({ dateKey, events }));
}
