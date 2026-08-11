import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { distinctInstruments } from "@/lib/instruments";

/**
 * Distinct instrument symbols already logged in the active journal, for a
 * self-curating `<datalist>` on the free instrument field (cyclus 7 refinement).
 *
 * Forex journals pick from the fixed pair enum, so this only matters for a
 * non-forex journal — pass `enabled: false` there to skip the query entirely.
 * Scoped by `methodology_id` (the active journal) exactly like `useTrades`, so a
 * multi-asset user never sees another book's tickers; both live and backtest
 * trades of the journal share one instrument universe, so neither is excluded.
 */
export function useInstrumentSuggestions(enabled: boolean): string[] {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const activeJournalId = profile?.methodology_id ?? null;
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      let query = supabase.from("trades").select("instrument").eq("user_id", userId);
      query = activeJournalId
        ? query.eq("methodology_id", activeJournalId)
        : query.is("methodology_id", null);
      const { data } = await query;
      if (cancelled || !data) return;
      setSuggestions(distinctInstruments(data as { instrument: string | null }[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, activeJournalId]);

  return suggestions;
}
