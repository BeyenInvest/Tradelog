/**
 * Tolerant number/date coercion for broker exports, which are wildly
 * inconsistent across platforms and locales. Kept pure and unit-tested so the
 * parsers stay declarative.
 */

/**
 * Parses a broker-formatted number. Handles thousands separators, comma or dot
 * decimals, surrounding spaces/currency text, and parenthesised negatives
 * ("(12.34)" = -12.34). Returns null for blank/uninterpretable input.
 */
export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === "") return null;

  // TradingView (and some locales) emit the Unicode minus/dashes instead of the
  // ASCII hyphen — normalise before the sign check below.
  s = s.replace(/[−–—]/g, "-");

  let negative = false;
  // Parenthesised negatives, common in accounting-style profit columns.
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes("-")) negative = true;

  // Drop everything that isn't a digit or a separator (currency symbols, spaces, +/- signs, letters).
  s = s.replace(/[^\d.,]/g, "");
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present → the rightmost separator is the decimal point, the other is thousands.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    // Only commas. "1,234" (groups of exactly 3) reads as thousands; otherwise a decimal comma.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  // Only dots (or none) needs no separator surgery.

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/** How to read an ambiguous "a/b/yyyy" date where both groups could be a month: day-first (EU) or month-first (US). */
export type DateOrder = "dmy" | "mdy";

const YEAR_FIRST_RE = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;
const YEAR_LAST_RE = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/;

/**
 * Extracts a `yyyy-mm-dd` calendar date from a broker timestamp. Supports the
 * common export layouts:
 *   - "2024.03.15 14:30:00"      (MetaTrader)
 *   - "2024-03-15T14:30:00.000"  (ISO)
 *   - "15/03/2024 14:30:00"      (day-first slash — cTrader/EU)
 * Returns null if no plausible date is found. Time-of-day is intentionally
 * dropped: the app stores dates only (datum_open is a DATE). Broker server-time
 * vs. local-time / DST is a known limitation, noted for when real exports land.
 *
 * A year-last date where either group is > 12 disambiguates itself; when both
 * could be a month (N9: "03/04/2024"), `dateOrder` decides — day-first by
 * default (MetaTrader/cTrader EU exports), month-first when the user says the
 * file is a US-style export (see isAmbiguousDate / the import dialog's choice).
 */
export function parseDateOnly(raw: string, dateOrder: DateOrder = "dmy"): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // yyyy[-./]mm[-./]dd (ISO-ish, year first)
  let m = s.match(YEAR_FIRST_RE);
  if (m) return iso(m[1], m[2], m[3]);

  // dd[-./]mm[-./]yyyy (day or month first, 4-digit year last)
  m = s.match(YEAR_LAST_RE);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let day = m[1];
    let month = m[2];
    if (a <= 12 && (b > 12 || dateOrder === "mdy")) {
      // First group must be the month (second can't be one), or the user chose month-first.
      day = m[2];
      month = m[1];
    }
    return iso(m[3], month, day);
  }

  return null;
}

/**
 * True when a raw timestamp reads as a *different* calendar date under "dmy" vs
 * "mdy" — i.e. year-last with both groups ≤ 12 and unequal ("03/04/2024", but
 * not "05/05/2024" or "15/03/2024"). Parsers count these so the import dialog
 * knows to ask the user which format the file uses (N9) instead of silently
 * guessing day-first on a US export.
 */
export function isAmbiguousDate(raw: string): boolean {
  if (!raw) return false;
  const s = raw.trim();
  if (YEAR_FIRST_RE.test(s)) return false; // year-first is never ambiguous
  const m = s.match(YEAR_LAST_RE);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a >= 1 && a <= 12 && b >= 1 && b <= 12 && a !== b;
}

function iso(y: string, m: string, d: string): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // Date-roundtrip check (N9): JS Date rolls an impossible date over (Feb 30 →
  // Mar 1/2) — reject those instead of storing a date that never existed.
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
