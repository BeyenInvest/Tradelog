// F3a — snapshot-pipeline (plan §2.1/F3a). Cyclus: per gewenst slot de chart
// naar dat timeframe zetten → captureVisibleTab → croppen op de chart-rect →
// uploaden naar de bestaande screenshots-bucket ({uid}/{uuid}.png, zelfde
// contract als src/lib/storage/screenshots.ts) → paden voor de vier vaste
// trade-kolommen teruggeven. Afsluiten = ALTIJD terug naar het oorspronkelijke
// timeframe, ook na fouten.
//
// Bekende beperking (S0-bewezen): captureVisibleTab vereist een activeTab-
// gebaar — host-permission op tradingview.com is níet genoeg. Zonder gebaar
// geeft Chrome een permissie-fout; die vertalen we naar code "needs-gesture"
// zodat de UI kan zeggen: "klik één keer op het Beyen-icoon in de werkbalk".

export const SNAPSHOT_SLOTS = ["w", "d", "h4", "h2"] as const;
export type SnapshotSlot = (typeof SNAPSHOT_SLOTS)[number];

/** Vaste W/D/4H/2H-slots (plan C4) → TV-resolutions. */
export const SLOT_RESOLUTIONS: Record<SnapshotSlot, string> = {
  w: "W",
  d: "D",
  h4: "240",
  h2: "120",
};

export const SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024; // bucket-limiet 0039

export interface ChartRect {
  x: number;
  y: number;
  w: number;
  h: number;
  dpr: number;
}

export type SlotResult = { ok: true; path: string; bytes: number } | { ok: false; error: string; code?: "needs-gesture" };

export interface SnapshotCycleResult {
  slots: Partial<Record<SnapshotSlot, SlotResult>>;
  /** false als het oorspronkelijke timeframe niet kon worden hersteld. */
  restored: boolean;
}

/** Afhankelijkheden geïnjecteerd zodat de cyclus-logica puur testbaar is. */
export interface SnapshotDeps {
  getResolution(): Promise<string | null>;
  setResolution(resolution: string): Promise<boolean>;
  getChartRect(): Promise<ChartRect | null>;
  /** Volledige zichtbare tab als PNG-blob (captureVisibleTab + decode). */
  captureVisible(): Promise<Blob>;
  crop(full: Blob, rect: ChartRect): Promise<Blob>;
  upload(image: Blob): Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  /** Wachten tot TV het nieuwe timeframe gerenderd heeft. */
  settle(): Promise<void>;
}

function isGestureError(message: string): boolean {
  return /activeTab|<all_urls>|permission/i.test(message);
}

async function captureSlot(deps: SnapshotDeps): Promise<SlotResult> {
  let full: Blob;
  try {
    full = await deps.captureVisible();
  } catch (e) {
    const msg = String((e instanceof Error && e.message) || e);
    return isGestureError(msg)
      ? { ok: false, error: msg, code: "needs-gesture" }
      : { ok: false, error: msg };
  }
  const rect = await deps.getChartRect();
  if (!rect) return { ok: false, error: "chart-rect onbepaalbaar" };
  let image: Blob;
  try {
    image = await deps.crop(full, rect);
  } catch (e) {
    return { ok: false, error: `crop: ${String((e instanceof Error && e.message) || e)}` };
  }
  if (image.size > SNAPSHOT_MAX_BYTES) {
    return { ok: false, error: `snapshot te groot (${image.size} bytes > 5 MB)` };
  }
  const uploaded = await deps.upload(image);
  if (!uploaded.ok) return { ok: false, error: `upload: ${uploaded.error}` };
  return { ok: true, path: uploaded.path, bytes: image.size };
}

export async function runSnapshotCycle(deps: SnapshotDeps, slots: SnapshotSlot[]): Promise<SnapshotCycleResult> {
  const wanted = SNAPSHOT_SLOTS.filter((s) => slots.includes(s)); // vaste volgorde W→D→4H→2H
  const results: SnapshotCycleResult["slots"] = {};
  const original = await deps.getResolution();

  for (const slot of wanted) {
    const target = SLOT_RESOLUTIONS[slot];
    if (original === target) {
      // Al op dit timeframe — niet onnodig switchen.
      results[slot] = await captureSlot(deps);
      continue;
    }
    const switched = await deps.setResolution(target);
    if (!switched) {
      results[slot] = { ok: false, error: `kon timeframe ${target} niet zetten` };
      continue;
    }
    await deps.settle();
    results[slot] = await captureSlot(deps);
    // Eén gebaar-fout betekent: álles gaat falen — stop de cyclus vroeg.
    const r = results[slot];
    if (r && !r.ok && r.code === "needs-gesture") break;
  }

  let restored = true;
  if (original) {
    const current = await deps.getResolution();
    if (current !== original) {
      restored = await deps.setResolution(original);
    }
  }
  return { slots: results, restored };
}

/** Crop in de service worker: createImageBitmap + OffscreenCanvas (S0-bewezen). */
export async function cropToRect(full: Blob, rect: ChartRect): Promise<Blob> {
  const bmp = await createImageBitmap(full);
  const sx = Math.max(0, Math.round(rect.x * rect.dpr));
  const sy = Math.max(0, Math.round(rect.y * rect.dpr));
  const sw = Math.min(bmp.width - sx, Math.round(rect.w * rect.dpr));
  const sh = Math.min(bmp.height - sy, Math.round(rect.h * rect.dpr));
  if (sw <= 0 || sh <= 0) throw new Error("crop buiten beeld");
  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("geen 2d-context");
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.convertToBlob({ type: "image/png" });
}
