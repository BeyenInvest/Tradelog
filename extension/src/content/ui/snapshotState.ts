// Beslislogica van de snapshot-sectie (F3b). Pure module — snapshotsSection.ts
// rendert alleen wat hier uitkomt, zoals form.ts dat met fields.ts doet.
//
// Drie regels die de vorm verklaren:
//  1. Eén slot heeft óf een auto-snapshot (mee in de cyclus) óf een geplakte
//     externe link. Een geldige link wint: dat slot doet dan niet mee.
//  2. Alles wat we uploadden en nooit in een trade stopten is een wees. De
//     opruimlijst (uploadedPaths) bevat dáárom alleen storage-paden, nooit
//     geplakte links — die zijn van TradingView, niet van ons.
//  3. Een retry vervangt altijd het oude pad: het oude gaat weg (stale), het
//     nieuwe resultaat komt ervoor in de plaats, ook als de retry faalde.
import { t } from "../../i18nExt";
import { SNAPSHOT_SLOTS, type SlotResult, type SnapshotCycleResult, type SnapshotSlot } from "../../snapshots";

export interface SlotState {
  enabled: boolean;
  /** Rauwe invoer van het link-veld; leeg = auto-slot. */
  link: string;
  /** Laatste cyclus-resultaat, of null als dit slot nog niet gedraaid heeft. */
  result: SlotResult | null;
}

export type SnapshotState = Record<SnapshotSlot, SlotState>;

/** Timeframe-namen: in beide talen hetzelfde (trading-leenwoorden, zoals
 * Win/Loss/BE in de web-app) — daarom géén i18n-sleutel. */
export const SLOT_LABELS: Record<SnapshotSlot, string> = {
  w: "Weekly (W)",
  d: "Daily (D)",
  h4: "4H",
  h2: "Extra (2H)",
};

/** Slot → index in methodologies.screenshot_labels — zelfde volgorde als de
 * web-form (TechnicalSection: w/d/h4/h2 = slot 0..3). */
const SLOT_LABEL_INDEX: Record<SnapshotSlot, number> = { w: 0, d: 1, h4: 2, h2: 3 };

/** De naam van een slot zoals de user 'm kent: de eigen journal-naam (0060)
 * als die gezet is — exact wat de web-form toont — anders de timeframe-default.
 * Het capture-timeframe zelf verandert nooit mee: slot w blijft W schieten. */
export function slotLabel(slot: SnapshotSlot, custom: string[] | null | undefined): string {
  return custom?.[SLOT_LABEL_INDEX[slot]]?.trim() || SLOT_LABELS[slot];
}

/** Default: de drie vaste tijdframes aan, het extra slot uit (plan C4). */
export const DEFAULT_ENABLED: Record<SnapshotSlot, boolean> = { w: true, d: true, h4: true, h2: false };

export function initialState(enabled: Record<SnapshotSlot, boolean> = DEFAULT_ENABLED): SnapshotState {
  const state = {} as SnapshotState;
  for (const slot of SNAPSHOT_SLOTS) {
    state[slot] = { enabled: enabled[slot] ?? false, link: "", result: null };
  }
  return state;
}

/** Alleen https — een http- of javascript-link hoort niet in een trade-kolom. */
export function isExternalLink(raw: string): boolean {
  return /^https:\/\/\S+$/i.test(raw.trim());
}

/** De bruikbare link van een slot, of null (leeg of ongeldig). */
export function linkValue(slot: SlotState): string | null {
  const trimmed = slot.link.trim();
  return trimmed && isExternalLink(trimmed) ? trimmed : null;
}

/** De slots die de capture-cyclus in gaan: aan én zonder geldige link. */
export function autoSlots(state: SnapshotState): SnapshotSlot[] {
  return SNAPSHOT_SLOTS.filter((s) => state[s].enabled && linkValue(state[s]) === null);
}

/** Wat er als `request.screenshots` meegaat: link vóór pad, uit-slot = null. */
export function screenshotsForRequest(state: SnapshotState): Record<SnapshotSlot, string | null> {
  const out = {} as Record<SnapshotSlot, string | null>;
  for (const slot of SNAPSHOT_SLOTS) {
    const s = state[slot];
    if (!s.enabled) {
      out[slot] = null;
      continue;
    }
    const link = linkValue(s);
    out[slot] = link ?? (s.result?.ok ? s.result.path : null);
  }
  return out;
}

/** Elk storage-pad dat we nú vasthouden — de opruimlijst bij reset/sluiten. */
export function uploadedPaths(state: SnapshotState): string[] {
  const paths: string[] = [];
  for (const slot of SNAPSHOT_SLOTS) {
    const result = state[slot].result;
    if (result?.ok) paths.push(result.path);
  }
  return paths;
}

/** Het pad van één slot, als dat een echt geüpload storage-pad is. */
export function pathOf(state: SnapshotState, slot: SnapshotSlot): string | null {
  const result = state[slot].result;
  return result?.ok ? result.path : null;
}

/**
 * Cyclus-uitkomst in de staat prikken. Gevraagde slots waar de cyclus nooit aan
 * toekwam (hij stopt vroeg bij needs-gesture) krijgen een eigen, eerlijke fout —
 * liever dat dan een stille lege rij. `stale` = de paden die hierdoor vervangen
 * zijn en dus opgeruimd moeten worden.
 */
export function applyCycle(
  state: SnapshotState,
  requested: SnapshotSlot[],
  cycle: SnapshotCycleResult
): { state: SnapshotState; stale: string[] } {
  const next: SnapshotState = { ...state };
  const stale: string[] = [];
  for (const slot of SNAPSHOT_SLOTS) {
    if (!requested.includes(slot)) continue;
    const previous = pathOf(state, slot);
    if (previous) stale.push(previous);
    const result: SlotResult = cycle.slots[slot] ?? { ok: false, error: t("snap.notRun") };
    next[slot] = { ...state[slot], result };
  }
  return { state: next, stale };
}

export function needsGesture(state: SnapshotState): boolean {
  return SNAPSHOT_SLOTS.some((slot) => {
    const result = state[slot].result;
    return !!result && !result.ok && result.code === "needs-gesture";
  });
}

/** "u123/a1b2c3d4.png" → "…/a1b2c3d4.png" — genoeg om twee slots te onderscheiden. */
export function pathTail(path: string): string {
  const name = path.split("/").pop() ?? path;
  return `…/${name}`;
}

/** De preview-data-URL van een slot, alleen voor een geslaagd auto-slot. Een
 * geplakte link wint (dan tonen we niets van ons oude pad), en we accepteren
 * uitsluitend image-data-URLs — de waarde stak de SW→content-berichtgrens over. */
export function thumbOf(slot: SlotState): string | null {
  if (slot.link.trim()) return null;
  const result = slot.result;
  if (!result?.ok || !result.thumb) return null;
  return result.thumb.startsWith("data:image/") ? result.thumb : null;
}

export interface SlotStatus {
  kind: "auto" | "link" | "ok" | "error" | "gesture";
  text: string;
}

/** Eén regel per slot: wat dit slot nú met de trade meestuurt. */
export function slotStatus(slot: SlotState): SlotStatus {
  const trimmed = slot.link.trim();
  if (trimmed) {
    return isExternalLink(trimmed)
      ? { kind: "link", text: t("snap.status.link") }
      : { kind: "error", text: t("snap.status.badLink") };
  }
  const result = slot.result;
  if (!result) return { kind: "auto", text: t("snap.status.auto") };
  if (result.ok) return { kind: "ok", text: pathTail(result.path) };
  if (result.code === "needs-gesture") return { kind: "gesture", text: t("snap.gesture") };
  // De rauwe reden komt uit de service worker (snapshots.ts) en blijft
  // onvertaald — technisch detail, net als `detail` in errors.ts.
  return { kind: "error", text: result.error };
}

// ── sessionStorage (per tab, zoals de doel-keuze in panelApp) ───────────────

export function serializeEnabled(state: SnapshotState): string {
  const flags: Record<string, boolean> = {};
  for (const slot of SNAPSHOT_SLOTS) flags[slot] = state[slot].enabled;
  return JSON.stringify(flags);
}

/** Onleesbare of onvolledige opslag degradeert naar de default — nooit werpen. */
export function parseEnabled(raw: string | null): Record<SnapshotSlot, boolean> {
  const out = { ...DEFAULT_ENABLED };
  if (!raw) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object") return out;
  const flags = parsed as Record<string, unknown>;
  for (const slot of SNAPSHOT_SLOTS) {
    if (typeof flags[slot] === "boolean") out[slot] = flags[slot];
  }
  return out;
}
