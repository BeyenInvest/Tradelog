import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { DailyJournalEntry } from "@/lib/types";

/**
 * The dagboek: one short free-text note per calendar day. Like the Habits tracker
 * it sits next to (not inside) the per-journal features — it's GLOBAL per user,
 * with no active-journal scoping (0055), so switching journals never changes
 * which entries you see. There's therefore no journal requestId guard here.
 */
export function useDailyJournal() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [entries, setEntries] = useState<DailyJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Explicit user_id filter — an admin's blanket read-all policy means RLS
    // alone wouldn't scope this to the current user (see useTrades). Paginated
    // past the 1000-row cap with an id tie-breaker for a stable page order.
    const { data, error: fetchError } = await fetchAllPages<DailyJournalEntry>((from, to) =>
      supabase
        .from("daily_journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );
    if (fetchError) {
      setError(toErrorMessage(fetchError));
    } else {
      setEntries(data as DailyJournalEntry[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Save the note for one day. Upserts on (user_id, entry_date) so re-saving the
   * same day edits in place rather than creating a duplicate. user_id is stamped
   * explicitly (not left to the column default) so it matches the conflict target.
   */
  async function saveEntry(entryDate: string, content: string): Promise<DailyJournalEntry> {
    const { data, error: upsertError } = await supabase
      .from("daily_journal_entries")
      .upsert({ user_id: userId, entry_date: entryDate, content }, { onConflict: "user_id,entry_date" })
      .select()
      .single();
    if (upsertError) throw upsertError;
    await refresh();
    return data as DailyJournalEntry;
  }

  async function deleteEntry(id: string): Promise<void> {
    const { error: deleteError } = await supabase.from("daily_journal_entries").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  return { entries, loading, error, refresh, saveEntry, deleteEntry };
}
