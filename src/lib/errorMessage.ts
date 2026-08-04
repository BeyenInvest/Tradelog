/**
 * Known, safe-to-show translations for Supabase/PostgREST/network errors, checked in order
 * (first substring match wins). Anything not listed here falls back to the caller-provided
 * message instead of the raw error — the raw text can be English, or leak internal table/
 * constraint/policy names, which we never want to show directly in this Dutch-only UI.
 */
const KNOWN_ERROR_PATTERNS: [pattern: string, message: string][] = [
  ["duplicate key", "Deze combinatie bestaat al."],
  ["Invalid login credentials", "E-mail of wachtwoord is onjuist."],
  ["Email not confirmed", "Bevestig eerst je e-mailadres via de link die we hebben gestuurd."],
  ["User already registered", "Er bestaat al een account met dit e-mailadres."],
  ["JWT expired", "Je sessie is verlopen. Log opnieuw in."],
  ["Auth session missing", "Je sessie is verlopen. Log opnieuw in."],
  ["rate limit", "Te veel pogingen. Probeer het straks opnieuw."],
  ["Failed to fetch", "Kan geen verbinding maken met de server. Controleer je internetverbinding."],
  ["NetworkError", "Kan geen verbinding maken met de server. Controleer je internetverbinding."],
];

/** Turns a thrown Supabase/PostgREST error (or anything else) into a message safe to show the user. */
export function toErrorMessage(err: unknown, fallback = "Er ging iets mis"): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : null;
  if (!message) return fallback;
  const known = KNOWN_ERROR_PATTERNS.find(([pattern]) => message.includes(pattern));
  return known ? known[1] : fallback;
}
