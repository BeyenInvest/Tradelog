import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { WeeklyReview, WeeklyReviewInput } from "@/lib/types";

export function useWeeklyReviews() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  // Reviews follow the active journal (per-journal isolation, cyclus 3b).
  const activeJournalId = profile?.methodology_id ?? null;
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response from a previous journal landing after a newer
  // request and overwriting its reviews (M3 — same pattern as useTrades).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // Paginated past the 1000-row cap (H1) with an id tie-breaker for a stable
    // page order — see fetchAllPages. Explicit user_id filter — see useTrades
    // for why this can't be left to RLS alone.
    const { data, error: fetchError } = await fetchAllPages<WeeklyReview>((from, to) => {
      let query = supabase.from("weekly_reviews").select("*").eq("user_id", userId);
      // Scope to the active journal (cyclus 3b); null = unassigned journal.
      query = activeJournalId ? query.eq("methodology_id", activeJournalId) : query.is("methodology_id", null);
      return query
        .order("jaar", { ascending: false })
        .order("week_nummer", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    });
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (fetchError) {
      setError(toErrorMessage(fetchError));
    } else {
      setReviews(data as WeeklyReview[]);
    }
    setLoading(false);
  }, [userId, activeJournalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createReview(input: WeeklyReviewInput): Promise<WeeklyReview> {
    // Stamp the active journal so the review lands in (and stays visible in) it (cyclus 3b).
    const { data, error: insertError } = await supabase
      .from("weekly_reviews")
      .insert({ ...input, methodology_id: activeJournalId })
      .select()
      .single();
    if (insertError) throw insertError;
    await refresh();
    return data as WeeklyReview;
  }

  async function updateReview(id: string, input: Partial<WeeklyReviewInput>): Promise<WeeklyReview> {
    const { data, error: updateError } = await supabase.from("weekly_reviews").update(input).eq("id", id).select().single();
    if (updateError) throw updateError;
    await refresh();
    return data as WeeklyReview;
  }

  async function deleteReview(id: string): Promise<void> {
    const { error: deleteError } = await supabase.from("weekly_reviews").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  /**
   * Manual (re)link: a review created after its trades already exist won't be
   * caught by the trigger's INSERT-only auto-link, so this runs the same
   * linking logic explicitly. Since 0063 this is one RPC (security invoker,
   * RLS blijft gelden) instead of two PostgREST date-range updates: the
   * handelsweek-regel (zondag ≥ 22:00 → volgende week) is niet als datumrange
   * uit te drukken, en de RPC deelt trading_date_of() met de DB-triggers, dus
   * client en triggers kunnen nooit een andere week berekenen. The RPC unlinks
   * out-of-week trades and links the week's live journal trades in one pass
   * (idempotent in both directions), reading jaar/week/journal from the review
   * row itself — call it AFTER an update that moves the review. Returns the
   * number of linked trades.
   */
  async function linkTradesToReview(reviewId: string): Promise<number> {
    const { data, error: rpcError } = await supabase.rpc("relink_weekly_review", { p_review_id: reviewId });
    if (rpcError) throw rpcError;
    return (data as number) ?? 0;
  }

  return { reviews, loading, error, refresh, createReview, updateReview, deleteReview, linkTradesToReview };
}
