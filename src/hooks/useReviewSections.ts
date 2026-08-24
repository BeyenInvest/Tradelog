import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { ReviewSectionRow } from "@/lib/types";

/**
 * The active journal's configurable review-section rows (Fase N5). Read-only —
 * the forms and detail/PDF views feed these into resolveReviewSections() to render
 * the right sections. An unassigned (null) journal, or one that never customized,
 * has no rows and falls back to the built-in defaults inside the resolver.
 *
 * Scoped to profile.methodology_id exactly like useWeeklyReviews, with the same
 * request-id guard against a stale journal's response landing last (M3).
 */
export function useReviewSections() {
  const { profile } = useAuth();
  const activeJournalId = profile?.methodology_id ?? null;
  const [rows, setRows] = useState<ReviewSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    if (!activeJournalId) {
      if (requestId === requestIdRef.current) {
        setRows([]);
        setLoading(false);
      }
      return;
    }
    const { data, error: fetchError } = await supabase
      .from("review_sections")
      .select("*")
      .eq("methodology_id", activeJournalId)
      .order("sort_order", { ascending: true });
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (fetchError) {
      // Keep the previous rows on a flaky fetch (M7) — the review form would
      // otherwise snap back to defaults under the user's cursor.
      setError(toErrorMessage(fetchError));
    } else {
      setRows((data as ReviewSectionRow[]) ?? []);
    }
    setLoading(false);
  }, [activeJournalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rows, loading, error, refresh };
}

/**
 * The review-section rows of a specific journal, regardless of which journal is
 * active (Fase N5) — used by the admin read-only review modals, which view
 * another user's review and read its sections through the admin SELECT policy
 * (0048). null methodology (legacy/unassigned journal) → no rows → defaults.
 */
export function useReviewSectionsFor(methodologyId: string | null) {
  const [rows, setRows] = useState<ReviewSectionRow[]>([]);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (!methodologyId) {
      setRows([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("review_sections")
        .select("*")
        .eq("methodology_id", methodologyId)
        .order("sort_order", { ascending: true });
      if (requestId === requestIdRef.current) setRows((data as ReviewSectionRow[]) ?? []);
    })();
  }, [methodologyId]);

  return rows;
}
