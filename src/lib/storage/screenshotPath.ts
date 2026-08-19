/**
 * Pure classification of a stored screenshot value — no supabase import, so it's
 * unit-testable in isolation. A `trades.*_screenshot` value is either a private-
 * bucket path (produced by uploadScreenshot as `{user_id}/{uuid}.ext`) or an
 * external URL (a full https link, or a legacy schemeless host).
 */

/** Matches a leading UUID folder segment — the shape every uploaded path starts with. */
const STORAGE_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i;

export function isStoragePath(value: string): boolean {
  return STORAGE_PATH_RE.test(value.trim());
}

/** External values are used as-is, prepending https:// to a schemeless host — matching the legacy URL field's behaviour. */
export function toExternalUrl(value: string): string {
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
