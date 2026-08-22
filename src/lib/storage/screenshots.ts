import { supabase } from "@/lib/supabase";
import { isStoragePath, toExternalUrl } from "./screenshotPath";

export { isStoragePath } from "./screenshotPath";

/**
 * Screenshot storage helpers (Fase K).
 *
 * The `trades.*_screenshot` columns store a plain string that is EITHER:
 *   - an external URL (legacy value, or a manually pasted TradingView link) —
 *     recognised by `isExternalUrl` (starts with http/https), used as-is; or
 *   - a storage path in the private `screenshots` bucket (`{user_id}/{uuid}.png`)
 *     — resolved to a short-lived signed URL on demand.
 *
 * Keeping the same columns (no schema change) makes the feature purely additive:
 * every existing URL keeps working, new uploads just store a path instead.
 */

const BUCKET = "screenshots";
/** Signed-URL lifetime. Long enough to view/enlarge within an open form; short enough not to leak. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Kept in sync with the bucket limits in migration 0039 — enforced client-side too for a friendly error before the round-trip. */
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/png":
    default:
      return "png";
  }
}

/**
 * Upload an image blob to the signed-in user's own folder and return the storage
 * path to persist in the trade column. RLS (migration 0039) requires the first
 * path segment to be the user's uid, so that prefix is mandatory.
 */
export async function uploadScreenshot(file: Blob, userId: string): Promise<string> {
  const mime = file.type || "image/png";
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(mime)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** The four trade columns that can hold a screenshot value. */
export const SCREENSHOT_COLUMNS = ["w_screenshot", "d_screenshot", "h4_screenshot", "h2_screenshot"] as const;

type ScreenshotFields = Partial<Record<(typeof SCREENSHOT_COLUMNS)[number], string | null>>;

/** The private-bucket storage paths a trade row references (external URLs are not ours to delete). */
export function screenshotStoragePaths(trade: ScreenshotFields): string[] {
  return SCREENSHOT_COLUMNS.map((col) => (trade[col] ?? "").trim()).filter((v) => v !== "" && isStoragePath(v));
}

/**
 * Best-effort removal of uploaded screenshot files (N2-lifecycle): called after
 * a trade delete or after an edit replaced/cleared an uploaded screenshot, so
 * files don't pile up as orphans in the private bucket. Deliberately never
 * throws — the trade mutation already succeeded, and a failed cleanup must not
 * surface as a failed save (account deletion (0044) erases the whole {uid}/
 * folder anyway, so a missed file here is not permanent).
 */
export async function removeScreenshots(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {
    // swallow — see above
  }
}

/**
 * Turn a stored screenshot value into something an <img>/react-pdf <Image> can
 * load. External URLs pass through unchanged; bucket paths get a fresh signed
 * URL. Returns null when the value is empty or the signed URL can't be minted
 * (e.g. the object was removed) so callers can show a graceful fallback.
 */
export async function resolveScreenshotUrl(value: string | null | undefined): Promise<string | null> {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!isStoragePath(v)) return toExternalUrl(v);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(v, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
