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

/**
 * Extracts a `yyyy-mm-dd` calendar date from a broker timestamp. Supports the
 * common export layouts:
 *   - "2024.03.15 14:30:00"      (MetaTrader)
 *   - "2024-03-15T14:30:00.000"  (ISO)
 *   - "15/03/2024 14:30:00"      (day-first slash — cTrader/EU)
 * Returns null if no plausible date is found. Time-of-day is intentionally
 * dropped: the app stores dates only (datum_open is a DATE). Broker server-time
 * vs. local-time / DST is a known limitation, noted for when real exports land.
 */
export function parseDateOnly(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // yyyy[-./]mm[-./]dd (ISO-ish, year first)
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return iso(m[1], m[2], m[3]);

  // dd[-./]mm[-./]yyyy (day or month first, 4-digit year last)
  m = s.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (m) {
    let day = m[1];
    let month = m[2];
    // If the first group can't be a month it must be the day (day-first); otherwise
    // assume day-first anyway, since MetaTrader/cTrader's EU exports are day-first.
    if (Number(m[1]) <= 12 && Number(m[2]) > 12) {
      day = m[2];
      month = m[1];
    }
    return iso(m[3], month, day);
  }

  return null;
}

function iso(y: string, m: string, d: string): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
