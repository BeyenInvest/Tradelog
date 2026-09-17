// Pure logica voor het verslepen van de launcher (het zwevende BY-bolletje).
// panel.ts doet alleen de pointer-events; alles wat te beredeneren valt staat
// hier, unit-getest (launcherDrag.test.ts).

/** chrome.storage.local-sleutel; positie geldt voor alle TV-tabs. */
export const LAUNCHER_POS_KEY = "launcherPos";

export interface LauncherPos {
  x: number;
  y: number;
}

/** Opgeslagen positie valideren — alles wat geen eindig {x,y}-paar is → null. */
export function parseStoredPos(raw: unknown): LauncherPos | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { x, y } = raw as { x?: unknown; y?: unknown };
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Binnen het viewport houden, met een kleine marge. De linker/boven-grens wint
 * van de rechter/onder-grens zodat een element groter dan het viewport (het
 * geopende paneel op een klein venster) met zijn kop zichtbaar blijft.
 */
export function clampLauncherPos(
  pos: LauncherPos,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  margin = 8
): LauncherPos {
  const x = Math.max(margin, Math.min(pos.x, viewport.w - size.w - margin));
  const y = Math.max(margin, Math.min(pos.y, viewport.h - size.h - margin));
  return { x, y };
}

/** Pas vanaf deze afstand is het een sleep — eronder blijft het een klik. */
export function isDrag(dx: number, dy: number, threshold = 4): boolean {
  return Math.hypot(dx, dy) >= threshold;
}
