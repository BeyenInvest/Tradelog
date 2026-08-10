import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { PeriodicReview, PeriodicReviewInput } from "@/lib/types";
import type { PeriodType } from "@/lib/constants";

export function usePeriodicReviews(periodType: PeriodType) {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  // Reviews follow the active journal (per-journal isolation, cyclus 3b).
  const activeJournalId = profile?.methodology_id ?? null;
  const [reviews, setReviews] = useState<PeriodicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Explicit user_id filter — see useTrades for why this can't be left to RLS alone.
    let query = supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("period_type", periodType);
    // Scope to the active journal (cyclus 3b); null = unassigned journal.
    query = activeJournalId ? query.eq("methodology_id", activeJournalId) : query.is("methodology_id", null);
    const { data, error: fetchError } = await query
      .order("jaar", { ascending: false })
      .order("periode_nummer", { ascending: false, nullsFirst: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setReviews(data as PeriodicReview[]);
    }
    setLoading(false);
  }, [periodType, userId, activeJournalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createReview(input: PeriodicReviewInput): Promise<PeriodicReview> {
    // Stamp the active journal so the review lands in (and stays visible in) it (cyclus 3b).
    const { data, error: insertError } = await supabase
      .from("periodic_reviews")
      .insert({ ...input, methodology_id: activeJournalId })
      .select()
      .single();
    if (insertError) throw insertError;
    await refresh();
    return data as PeriodicReview;
  }

  async function updateReview(id: string, input: Partial<PeriodicReviewInput>): Promise<PeriodicReview> {
    const { data, error: updateError } = await supabase.from("periodic_reviews").update(input).eq("id", id).select().single();
    if (updateError) throw updateError;
    await refresh();
    return data as PeriodicReview;
  }

  async function deleteReview(id: string): Promise<void> {
    const { error: deleteError } = await supabase.from("periodic_reviews").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  return { reviews, loading, error, refresh, createReview, updateReview, deleteReview };
}
