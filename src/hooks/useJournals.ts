import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";

/** One of the signed-in user's own journals (methodologies), for the switcher. */
export interface JournalSummary {
  id: string;
  naam: string;
  asset_class: string | null;
}

/** What a journal still holds — used both for the switcher counter (trades) and the delete guard (all three). */
export interface JournalCounts {
  trades: number;
  reviews: number;
  accounts: number;
}

/**
 * Lists the signed-in user's own journals, switches the active one, and manages
 * them — rename + delete (cyclus 3b + fase B). A journal is a user-owned
 * methodology (optie B); the built-in system templates are excluded (a user
 * always works on a fork). Switching = repointing profiles.methodology_id via
 * updateProfile, which reloads every journal-scoped hook downstream.
 *
 * Delete is deliberately block-when-non-empty: trades/reviews/accounts FK to a
 * methodology with ON DELETE SET NULL, so hard-deleting a non-empty journal would
 * silently orphan that data out of every journal-scoped view rather than remove
 * it. So a journal must be empty (and neither the active nor the last one) before
 * it can go — enforced here as the backstop, surfaced in the switcher UI.
 * methodology_fields/fases cascade away with the journal (they're config).
 */
export function useJournals() {
  const { profile, updateProfile } = useAuth();
  const userId = profile?.id ?? null;
  const activeId = profile?.methodology_id ?? null;
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [tradeCounts, setTradeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setJournals([]);
      setTradeCounts({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("methodologies")
      .select("id, naam, asset_class")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (err) {
      setError(toErrorMessage(err));
      setLoading(false);
      return;
    }
    const list = (data as JournalSummary[] | null) ?? [];
    setJournals(list);
    setLoading(false);

    // Live *realized* trade count per journal — matches the journal header's count
    // (realTrades = closedTrades(takenTrades)), so a journal reads the same number in
    // both places. Head-only exact counts (no rows pulled). Backtest trades live under
    // a project, so they're excluded; missed trades are hypothetical and still-running
    // open trades have no result yet — neither dilutes the count. realized = all-live −
    // missed-live − open-live keeps it consistent without a null-prone "not missed"
    // filter (missed and open are mutually exclusive — see trades_open_no_eval_chk — so
    // the two subtractions never overlap). A handful of journals → a few tiny requests each.
    const entries = await Promise.all(
      list.map(async (j) => {
        const base = () =>
          supabase.from("trades").select("*", { count: "exact", head: true }).eq("methodology_id", j.id).is("backtest_project_id", null);
        const [all, missed, open] = await Promise.all([
          base(),
          base().eq("trade_evaluation", "Missed trade"),
          base().eq("is_open", true),
        ]);
        return [j.id, (all.count ?? 0) - (missed.count ?? 0) - (open.count ?? 0)] as const;
      })
    );
    setTradeCounts(Object.fromEntries(entries));
    // activeId in deps: creating a journal (PresetPicker) repoints the active journal
    // but not this list — refetch on that change so a freshly made journal shows up
    // immediately instead of the switcher falling back to "unknown" until a reload.
  }, [userId, activeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchJournal = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      await updateProfile({ methodology_id: id });
    },
    [activeId, updateProfile]
  );

  /** Rename an own journal. Trims; a blank name is rejected (the switcher validates before calling). */
  const renameJournal = useCallback(
    async (id: string, naam: string) => {
      const trimmed = naam.trim();
      if (!trimmed) throw new Error("empty name");
      const { error: err } = await supabase.from("methodologies").update({ naam: trimmed }).eq("id", id);
      if (err) throw err;
      await load();
    },
    [load]
  );

  /**
   * The journal-scoped data a delete would orphan — the delete guard blocks on any
   * of it. Only *live* trades count: backtest projects aren't journal-scoped (no
   * methodology_id column), so their trades stay reachable via their project after
   * the journal goes, and their methodology_id → null is harmless. Reviews and
   * prop-accounts are journal-scoped, so they always block.
   */
  const fetchCounts = useCallback(async (id: string): Promise<JournalCounts> => {
    const headCount = (table: string) =>
      supabase.from(table).select("*", { count: "exact", head: true }).eq("methodology_id", id);
    const [tr, wr, pr, acc] = await Promise.all([
      headCount("trades").is("backtest_project_id", null),
      headCount("weekly_reviews"),
      headCount("periodic_reviews"),
      headCount("prop_accounts"),
    ]);
    return {
      trades: tr.count ?? 0,
      reviews: (wr.count ?? 0) + (pr.count ?? 0),
      accounts: acc.count ?? 0,
    };
  }, []);

  /**
   * Delete an own journal. Guarded: never the active one (switch first), never the
   * last one, and never a non-empty one (would orphan its data — see the hook doc).
   * Re-checks emptiness server-side so a stale UI can't slip a non-empty delete past.
   */
  const deleteJournal = useCallback(
    async (id: string) => {
      if (id === activeId) throw new Error("cannot delete the active journal");
      if (journals.length <= 1) throw new Error("cannot delete the last journal");
      const counts = await fetchCounts(id);
      if (counts.trades > 0 || counts.reviews > 0 || counts.accounts > 0) {
        throw new Error("journal is not empty");
      }
      const { error: err } = await supabase.from("methodologies").delete().eq("id", id);
      if (err) throw err;
      await load();
    },
    [activeId, journals.length, fetchCounts, load]
  );

  return {
    journals,
    activeId,
    tradeCounts,
    loading,
    error,
    switchJournal,
    renameJournal,
    deleteJournal,
    fetchCounts,
    refresh: load,
  };
}
