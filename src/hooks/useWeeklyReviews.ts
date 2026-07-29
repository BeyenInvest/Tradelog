import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { WeeklyReview, WeeklyReviewInput } from "@/lib/types";
import { isoWeekRange } from "@/lib/isoWeek";

export function useWeeklyReviews() {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("weekly_reviews")
      .select("*")
      .order("jaar", { ascending: false })
      .order("week_nummer", { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setReviews(data as WeeklyReview[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createReview(input: WeeklyReviewInput): Promise<WeeklyReview> {
    const { data, error: insertError } = await supabase.from("weekly_reviews").insert(input).select().single();
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
   * Manual backfill: a review created after its trades already exist won't be
   * caught by the trigger's INSERT-only auto-link, so this runs the same
   * linking logic explicitly for that week's date range.
   *
   * Scoped to live trades only — weekly reviews are a Journal concept, and a
   * backtest project's trades must never be pulled into one just because their
   * dates happen to fall in the same week.
   */
  async function linkTradesToReview(reviewId: string, jaar: number, weekNummer: number): Promise<number> {
    const { start, end } = isoWeekRange(jaar, weekNummer);
    const { data, error: linkError } = await supabase
      .from("trades")
      .update({ weekly_review_id: reviewId })
      .is("backtest_project_id", null)
      .gte("datum_open", start)
      .lte("datum_open", end)
      .select("id");
    if (linkError) throw linkError;
    return (data ?? []).length;
  }

  return { reviews, loading, error, refresh, createReview, updateReview, deleteReview, linkTradesToReview };
}
