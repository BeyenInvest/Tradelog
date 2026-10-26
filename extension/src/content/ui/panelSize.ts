// Pure logica voor het vergroten/verkleinen van het open paneel (de greepjes in
// de onderhoeken). panel.ts doet de pointer-events; dit is unit-getest
// (panelSize.test.ts).

/** chrome.storage.local-sleutel; de maat geldt voor alle TV-tabs. */
export const PANEL_SIZE_KEY = "panelSize";

/** Kleiner dan dit wordt het formulier onbruikbaar (knoppenrijen lopen over). */
export const PANEL_MIN = { w: 300, h: 280 } as const;

export interface PanelSize {
  w: number;
  h: number;
}

/** Opgeslagen maat valideren — alles wat geen eindig, positief {w,h}-paar is → null. */
export function parseStoredSize(raw: unknown): PanelSize | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { w, h } = raw as { w?: unknown; h?: unknown };
  if (typeof w !== "number" || typeof h !== "number") return null;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Tussen het minimum en de beschikbare ruimte houden. Is er minder ruimte dan
 * het minimum (heel klein venster), dan wint het minimum — het paneel scrollt
 * dan zelf, en de positie-klem houdt de kop in beeld.
 */
export function clampPanelSize(size: PanelSize, available: PanelSize): PanelSize {
  return {
    w: Math.round(Math.max(PANEL_MIN.w, Math.min(size.w, available.w))),
    h: Math.round(Math.max(PANEL_MIN.h, Math.min(size.h, available.h))),
  };
}
