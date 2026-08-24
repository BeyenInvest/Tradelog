/**
 * Tiny per-journal recall of the last-used instrument and planned risk, so the
 * next trade (quick-log or the full form) opens pre-filled with what you almost
 * always repeat — a friction cut, never a source of truth (the value is only a
 * default the user can override, and it's scoped per methodology so two journals
 * don't bleed into each other). All access is wrapped: a disabled/full
 * localStorage must never break opening the form.
 */

const INSTRUMENT_KEY = "beyen:lastInstrument";
const RISK_KEY = "beyen:lastRisk";

function scopedKey(base: string, methodologyId: string | null): string {
  return `${base}:${methodologyId ?? "legacy"}`;
}

function read(base: string, methodologyId: string | null): string | null {
  try {
    return localStorage.getItem(scopedKey(base, methodologyId));
  } catch {
    return null;
  }
}

function write(base: string, methodologyId: string | null, value: string): void {
  try {
    localStorage.setItem(scopedKey(base, methodologyId), value);
  } catch {
    /* storage disabled/full — remembering is best-effort */
  }
}

export function getLastInstrument(methodologyId: string | null): string | null {
  return read(INSTRUMENT_KEY, methodologyId);
}

export function setLastInstrument(methodologyId: string | null, instrument: string | null): void {
  if (instrument) write(INSTRUMENT_KEY, methodologyId, instrument);
}

export function getLastRisk(methodologyId: string | null): number | null {
  const raw = read(RISK_KEY, methodologyId);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastRisk(methodologyId: string | null, risk: number | null | undefined): void {
  if (risk != null && Number.isFinite(risk) && risk > 0) write(RISK_KEY, methodologyId, String(risk));
}
