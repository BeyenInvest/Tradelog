import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/** One of the signed-in user's own journals (methodologies), for the switcher. */
export interface JournalSummary {
  id: string;
  naam: string;
  asset_class: string | null;
}

/**
 * Lists the signed-in user's own journals and switches the active one (cyclus 3b).
 * A journal is a user-owned methodology (optie B) — the built-in system templates
 * are excluded (a user always works on a fork, never the world-readable template).
 * Switching = repointing profiles.methodology_id via updateProfile, which reloads
 * every journal-scoped hook (trades, reviews, accounts, useMethodology) downstream.
 * Creating a journal is not here — that reuses the PresetPicker (fork/blank), which
 * already creates a new book and switches to it.
 */
export function useJournals() {
  const { profile, updateProfile } = useAuth();
  const userId = profile?.id ?? null;
  const activeId = profile?.methodology_id ?? null;
  const [journals, setJournals] = useState<JournalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setJournals([]);
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
      setError(err.message);
      setLoading(false);
      return;
    }
    setJournals((data as JournalSummary[] | null) ?? []);
    setLoading(false);
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

  return { journals, activeId, loading, error, switchJournal, refresh: load };
}
