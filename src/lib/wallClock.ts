// Wall-clock-helper voor de TV-extensie (F2b/F5). Eigen mini-module — bewust
// LOS van tradePayload.ts: het sluit-pad van het paneel (closeFlow) heeft
// alleen deze datum-conversie nodig, en een import uit tradePayload zou
// validation.ts + heel zod het content-script in trekken (gemeten: ~140 KB
// extra bundle). tradePayload re-exporteert dit voor bestaande importeurs.

export interface WallClock {
  /** "YYYY-MM-DD" in de doel-tijdzone. */
  date: string;
  /** "HH:MM" in de doel-tijdzone. */
  time: string;
}

/**
 * UTC-instant → wall-clock in een IANA-tijdzone (M4). `datum_open`/`tijd_open`
 * zijn wall-clock in profiles.timezone — de sessie-trigger rekent daarmee, dus
 * een fout hier vervuilt de sessie-breakdown onzichtbaar. Null bij een
 * onbruikbare timestamp of onbekende tijdzone.
 */
export function wallClockInTimezone(utcMs: number, timeZone: string): WallClock | null {
  if (!Number.isFinite(utcMs)) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
    const [y, mo, d, h, mi] = [get("year"), get("month"), get("day"), get("hour"), get("minute")];
    if (!y || !mo || !d || !h || !mi) return null;
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  } catch {
    return null; // onbekende/kapotte tijdzone-string
  }
}
