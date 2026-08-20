import type { ShareLink } from "@/lib/types";

/**
 * Pure share-link rules (Fase M) — kept free of the supabase client (same split
 * as storage/screenshotPath.ts) so they're unit-testable without env vars.
 */

/** Expiry choices offered on create. Days, or null = never expires. */
export const SHARE_EXPIRY_CHOICES = [7, 30, 90, null] as const;
export type ShareExpiryChoice = (typeof SHARE_EXPIRY_CHOICES)[number];

/** ISO timestamp `days` from `now`, or null for a never-expiring link. */
export function expiryFromChoice(choice: ShareExpiryChoice, now: Date = new Date()): string | null {
  if (choice === null) return null;
  return new Date(now.getTime() + choice * 24 * 60 * 60 * 1000).toISOString();
}

export type ShareLinkStatus = "active" | "expired" | "revoked";

/** Revoked wins over expired — an owner who pulled a link shouldn't see it soften to "verlopen" later. */
export function shareLinkStatus(link: Pick<ShareLink, "revoked" | "expires_at">, now: Date = new Date()): ShareLinkStatus {
  if (link.revoked) return "revoked";
  if (link.expires_at !== null && new Date(link.expires_at) <= now) return "expired";
  return "active";
}

/** Absolute URL a coach opens. Origin passed in (window.location.origin) so this stays pure/testable. */
export function shareUrl(origin: string, token: string): string {
  return `${origin}/share/${token}`;
}
