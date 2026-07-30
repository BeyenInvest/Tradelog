/** Turns a thrown Supabase/PostgREST error (or anything else) into a message safe to show the user. */
export function toErrorMessage(err: unknown, fallback = "Er ging iets mis"): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : null;
  if (!message) return fallback;
  if (message.includes("duplicate key")) return "Deze combinatie bestaat al.";
  return message;
}
