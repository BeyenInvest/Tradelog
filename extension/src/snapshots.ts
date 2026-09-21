// F3a — snapshot-pipeline (plan §2.1/F3a). Cyclus: per gewenst slot de chart
// naar dat timeframe zetten → beeld maken; de upload naar de bestaande
// screenshots-bucket ({uid}/{uuid}.png, zelfde contract als
// src/lib/storage/screenshots.ts) loopt parallel door terwijl de chart al
// naar het volgende slot wisselt → paden voor de vier vaste trade-kolommen
// teruggeven. Afsluiten = ALTIJD terug naar het oorspronkelijke timeframe, ook
// na fouten.
//
// Het beeld komt primair uit TV's eigen `takeClientScreenshot()` (chart-only
// canvas via de page-world — geen permissie-gebaar, geen crop). Alleen de
// fallback (captureVisibleTab + crop, in sw.ts) kent nog de S0-beperking dat
// Chrome een activeTab-gebaar eist; dié vertaalt zich naar code
// "needs-gesture" zodat de UI kan zeggen: "klik één keer op het Beyen-icoon".

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

export type SlotResult =
  | { ok: true; path: string; bytes: number; thumb?: string }
  | { ok: false; error: string; code?: "needs-gesture" };

/** Bovengrens voor een preview-data-URL in het cyclus-resultaat: berichten
 * popup ⇄ SW zijn JSON, dus we houden previews klein (±35 KB base64). */
export const THUMB_MAX_CHARS = 48_000;

export interface SnapshotCycleResult {
  slots: Partial<Record<SnapshotSlot, SlotResult>>;
  /** false als het oorspronkelijke timeframe niet kon worden hersteld. */
  restored: boolean;
}

/** Uitkomst van één beeld-poging — de impl (sw.ts) kiest zelf het pad
 * (page-world-screenshot of captureVisibleTab-fallback) en levert het
 * chart-beeld al gecropt aan. */
export type CaptureResult =
  | { ok: true; image: Blob }
  | { ok: false; error: string; code?: "needs-gesture" };

/** Afhankelijkheden geïnjecteerd zodat de cyclus-logica puur testbaar is. */
export interface SnapshotDeps {
  getResolution(): Promise<string | null>;
  setResolution(resolution: string): Promise<boolean>;
  /** Chart-beeld als PNG-blob; "needs-gesture" alleen op het fallback-pad. */
  capture(): Promise<CaptureResult>;
  upload(image: Blob): Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  /** Wachten tot TV het gevraagde timeframe geladen én getekend heeft. Mag
   * nooit rejecten — de impl (sw.ts → wait-chart-ready) degradeert zelf. */
  settle(target: string): Promise<void>;
  /** Optioneel: kleine preview-data-URL van de snapshot voor de UI. Mag falen —
   * een preview is nice-to-have, nooit een reden om het slot te laten
   * mislukken. */
  thumbnail?(image: Blob): Promise<string | null>;
}

/** Chrome's permissie-fouten rond captureVisibleTab (fallback-pad, sw.ts). */
export function isGestureError(message: string): boolean {
  return /activeTab|<all_urls>|permission/i.test(message);
}

/** Upload + preview voor één al-gecaptured beeld. Rejects nooit — elke fout
 * wordt een net per-slot resultaat, ook als de promise pas later ge-await
 * wordt (parallel-pad). */
async function uploadSlot(deps: SnapshotDeps, image: Blob): Promise<SlotResult> {
  try {
    const uploaded = await deps.upload(image);
    if (!uploaded.ok) return { ok: false, error: `upload: ${uploaded.error}` };
    let thumb: string | undefined;
    if (deps.thumbnail) {
      try {
        const t = await deps.thumbnail(image);
        if (t && t.length <= THUMB_MAX_CHARS) thumb = t;
      } catch {
        // preview mislukt → slot blijft gewoon geslaagd
      }
    }
    return { ok: true, path: uploaded.path, bytes: image.size, thumb };
  } catch (e) {
    return { ok: false, error: `upload: ${String((e instanceof Error && e.message) || e)}` };
  }
}

export async function runSnapshotCycle(deps: SnapshotDeps, slots: SnapshotSlot[]): Promise<SnapshotCycleResult> {
  const wanted = SNAPSHOT_SLOTS.filter((s) => slots.includes(s)); // vaste volgorde W→D→4H→2H
  const results: SnapshotCycleResult["slots"] = {};
  // Uploads lopen buiten de kritieke keten (zie onder): capture per slot, maar
  // de upload+preview draait door terwijl de chart al naar het volgende
  // timeframe wisselt. Zelfde beelden, alleen niet meer serieel wachten.
  const pending: Array<{ slot: SnapshotSlot; result: Promise<SlotResult> }> = [];
  const original = await deps.getResolution();
  // Waar de chart NU op staat — schuift mee met elke switch. Vergelijken tegen
  // `original` zou fout gaan zodra een eerder slot al gewisseld heeft: een chart
  // die op 4H start kreeg dan bij het 4H-slot de Daily-capture (W-D-D-bug).
  let current = original;

  for (const slot of wanted) {
    const target = SLOT_RESOLUTIONS[slot];
    // Staat de chart al op dit timeframe, dan niet onnodig switchen — maar wél
    // settlen: hij kan nog laden van een handmatige wissel vlak vóór de cyclus.
    if (current !== target) {
      const switched = await deps.setResolution(target);
      if (!switched) {
        results[slot] = { ok: false, error: `kon timeframe ${target} niet zetten` };
        continue;
      }
      current = target;
    }
    await deps.settle(target);
    const captured = await deps.capture();
    if (!captured.ok) {
      results[slot] = captured;
      // Eén gebaar-fout betekent: álles gaat falen — stop de cyclus vroeg.
      if (captured.code === "needs-gesture") break;
      continue;
    }
    if (captured.image.size > SNAPSHOT_MAX_BYTES) {
      results[slot] = { ok: false, error: `snapshot te groot (${captured.image.size} bytes > 5 MB)` };
      continue;
    }
    pending.push({ slot, result: uploadSlot(deps, captured.image) });
  }

  // Eerst de chart teruggeven (het timeframe-herstel hoeft niet op de uploads
  // te wachten), dan pas de upload-resultaten verzamelen.
  let restored = true;
  if (original) {
    const now = await deps.getResolution();
    if (now !== original) {
      restored = await deps.setResolution(original);
    }
  }
  for (const p of pending) {
    results[p.slot] = await p.result;
  }
  return { slots: results, restored };
}

/** Uint8Array → base64 zonder de call-stack op te blazen (chunked fromCharCode). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Preview in de service worker: schaal de gecropte snapshot naar ±200 px breed
 * en lever 'm als JPEG-data-URL voor de slot-UI (F3b-spec: preview-thumbnail). */
export async function thumbnailDataUrl(image: Blob, maxWidth = 200): Promise<string | null> {
  const bmp = await createImageBitmap(image);
  const scale = Math.min(1, maxWidth / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
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
