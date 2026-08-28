/**
 * Tiny per-journal recall of the last-used instrument and planned risk, so the
 * next trade (quick-log or the full form) opens pre-filled with what you almost
 * always repeat — a friction cut, never a source of truth (the value is only a
 * default the user can override, and it's scoped per user + methodology so two
 * journals — and two accounts on the same browser — don't bleed into each other,
 * C6). All access is wrapped: a disabled/full localStorage must never break
 * opening the form.
 */

const INSTRUMENT_KEY = "beyen:lastInstrument";
const RISK_KEY = "beyen:lastRisk";

// userId first so the legacy/unscoped journal (methodologyId null) is still kept
// apart per account — the old `…:legacy` bucket was shared across every account.
function scopedKey(base: string, userId: string | null, methodologyId: string | null): string {
  return `${base}:${userId ?? "anon"}:${methodologyId ?? "legacy"}`;
}

function read(base: string, userId: string | null, methodologyId: string | null): string | null {
  try {
    return localStorage.getItem(scopedKey(base, userId, methodologyId));
  } catch {
    return null;
  }
}

function write(base: string, userId: string | null, methodologyId: string | null, value: string): void {
  try {
    localStorage.setItem(scopedKey(base, userId, methodologyId), value);
  } catch {
    /* storage disabled/full — remembering is best-effort */
  }
}

export function getLastInstrument(userId: string | null, methodologyId: string | null): string | null {
  return read(INSTRUMENT_KEY, userId, methodologyId);
}

export function setLastInstrument(userId: string | null, methodologyId: string | null, instrument: string | null): void {
  if (instrument) write(INSTRUMENT_KEY, userId, methodologyId, instrument);
}

export function getLastRisk(userId: string | null, methodologyId: string | null): number | null {
  const raw = read(RISK_KEY, userId, methodologyId);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastRisk(userId: string | null, methodologyId: string | null, risk: number | null | undefined): void {
  if (risk != null && Number.isFinite(risk) && risk > 0) write(RISK_KEY, userId, methodologyId, String(risk));
}
