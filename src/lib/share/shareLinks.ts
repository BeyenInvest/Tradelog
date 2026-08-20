import { supabase } from "@/lib/supabase";
import type { ShareLink, SharedJournal, SharedReview } from "@/lib/types";
import type { ReviewRef } from "./shareLinkStatus";

export * from "./shareLinkStatus";

/**
 * Share-links (Fase M): owner-side CRUD via RLS + the anonymous read path via
 * the get_shared_journal RPC (migration 0040). The token is a capability —
 * whoever holds the URL can view the journal read-only, so creation/revocation
 * stay behind the beta gate while the token view itself is per-token, not per-user.
 */

/** All of the owner's links for one journal (null = the legacy/unscoped journal), newest first. */
export async function listShareLinks(methodologyId: string | null): Promise<ShareLink[]> {
  let query = supabase.from("share_links").select("*").eq("scope", "journal");
  query = methodologyId ? query.eq("methodology_id", methodologyId) : query.is("methodology_id", null);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data as ShareLink[];
}

/** Create a link for one journal; the DB default generates the token. */
export async function createShareLink(userId: string, methodologyId: string | null, expiresAt: string | null): Promise<ShareLink> {
  const { data, error } = await supabase
    .from("share_links")
    .insert({ user_id: userId, methodology_id: methodologyId, scope: "journal", expires_at: expiresAt })
    .select()
    .single();
  if (error) throw error;
  return data as ShareLink;
}

/** Permanent: there is deliberately no un-revoke — the owner creates a fresh link instead. */
export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase.from("share_links").update({ revoked: true }).eq("id", id);
  if (error) throw error;
}

/** The anonymous read path. null = invalid/revoked/expired token (the RPC returns no row). */
export async function getSharedJournal(token: string): Promise<SharedJournal | null> {
  const { data, error } = await supabase.rpc("get_shared_journal", { share_token: token });
  if (error) throw error;
  return (data as SharedJournal | null) ?? null;
}

/** The review-link column that carries the ref — the other one stays null (DB CHECK 0042). */
function reviewRefColumn(ref: ReviewRef): "weekly_review_id" | "periodic_review_id" {
  return ref.kind === "weekly" ? "weekly_review_id" : "periodic_review_id";
}

/** All of the owner's links for one review, newest first. */
export async function listReviewShareLinks(ref: ReviewRef): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("scope", "review")
    .eq(reviewRefColumn(ref), ref.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ShareLink[];
}

/**
 * Create a link for one review; the DB default generates the token.
 * methodology_id stays null on review links — the journal follows from the
 * review row itself server-side, so there's no second source to keep in sync.
 */
export async function createReviewShareLink(userId: string, ref: ReviewRef, expiresAt: string | null): Promise<ShareLink> {
  const { data, error } = await supabase
    .from("share_links")
    .insert({ user_id: userId, scope: "review", [reviewRefColumn(ref)]: ref.id, expires_at: expiresAt })
    .select()
    .single();
  if (error) throw error;
  return data as ShareLink;
}

/** The anonymous read path for a shared review. null = invalid/revoked/expired token. */
export async function getSharedReview(token: string): Promise<SharedReview | null> {
  const { data, error } = await supabase.rpc("get_shared_review", { share_token: token });
  if (error) throw error;
  return (data as SharedReview | null) ?? null;
}
