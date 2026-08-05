import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { PeriodicReview, PeriodicReviewInput } from "@/lib/types";
import type { PeriodType } from "@/lib/constants";

export function usePeriodicReviews(periodType: PeriodType) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [reviews, setReviews] = useState<PeriodicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Explicit user_id filter — see useTrades for why this can't be left to RLS alone.
    const { data, error: fetchError } = await supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("period_type", periodType)
      .order("jaar", { ascending: false })
      .order("periode_nummer", { ascending: false, nullsFirst: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setReviews(data as PeriodicReview[]);
    }
    setLoading(false);
  }, [periodType, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createReview(input: PeriodicReviewInput): Promise<PeriodicReview> {
    const { data, error: insertError } = await supabase.from("periodic_reviews").insert(input).select().single();
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
