import i18n from "@/i18n";

/**
 * Known, safe-to-show Supabase/PostgREST/network errors, checked in order (first substring
 * match wins), each mapped to an i18n key resolved at call time (so the message follows the
 * active language). Anything not listed here falls back to the caller-provided message instead
 * of the raw error — the raw text can be English, or leak internal table/constraint/policy
 * names, which we never want to show directly.
 */
const KNOWN_ERROR_PATTERNS: [pattern: string, key: string][] = [
  ["duplicate key", "errors.duplicate"],
  ["Invalid login credentials", "errors.invalidLogin"],
  ["Email not confirmed", "errors.emailNotConfirmed"],
  ["User already registered", "errors.userExists"],
  ["JWT expired", "errors.sessionExpired"],
  ["Auth session missing", "errors.sessionExpired"],
  ["rate limit", "errors.rateLimit"],
  ["Failed to fetch", "errors.network"],
  ["NetworkError", "errors.network"],
];

/**
 * Extracts a string message from anything throwable. Supabase/PostgREST reject with a plain
 * `PostgrestError` object (`{ message, details, hint, code }`), NOT an `Error` instance — so an
 * `instanceof Error` check alone silently drops every database error to the fallback. We also read
 * `.message` off any object that carries a string one.
 */
function extractMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return null;
}

/** Turns a thrown Supabase/PostgREST error (or anything else) into a message safe to show the user. */
export function toErrorMessage(err: unknown, fallback?: string): string {
  const resolvedFallback = fallback ?? i18n.t("errors.generic");
  const message = extractMessage(err);
  if (!message) return resolvedFallback;
  const known = KNOWN_ERROR_PATTERNS.find(([pattern]) => message.includes(pattern));
  return known ? i18n.t(known[1]) : resolvedFallback;
}
