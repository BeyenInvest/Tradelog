import { PAIRS, type Pair } from "@/lib/constants";

const PAIR_SET = new Set<string>(PAIRS);

/** Common non-standard names brokers use for the metals we do support. */
const ALIASES: Record<string, Pair> = {
  GOLD: "XAUUSD",
  XAUEUR: "XAUUSD", // best-effort: we only carry XAUUSD
  SILVER: "XAGUSD",
};

/**
 * Reduces a raw broker symbol to one of our Pair enum values, or null if it
 * isn't a pair we track (indices like US30/NAS100, exotics, crypto — those go
 * to the manual mapping step). Strips the broker-specific suffixes and
 * separators that decorate the same instrument ("EURUSD.r", "EURUSD-ECN",
 * "EUR/USD", "eurusd.pro", "GBPUSDm").
 */
export function normalizeSymbol(raw: string): Pair | null {
  if (!raw) return null;
  // Keep only letters/digits, uppercase — drops ".", "/", "-", "_", spaces.
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (PAIR_SET.has(s)) return s as Pair;
  if (s in ALIASES) return ALIASES[s];

  // Strip a trailing broker account-type marker (a single letter or digits) then retry:
  // "GBPUSDM" -> "GBPUSD", "EURUSD1" -> "EURUSD".
  const stripped = s.replace(/[0-9]+$/, "").replace(/[A-Z]$/, "");
  if (PAIR_SET.has(stripped)) return stripped as Pair;

  // A leading 6-letter FX code with any trailing decoration ("EURUSDPRO", "EURUSDRAW").
  const head = s.slice(0, 6);
  if (PAIR_SET.has(head)) return head as Pair;

  return null;
}
