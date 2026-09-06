import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { TradeContract } from "@/lib/types";

/** The fields the signing form collects — the rest (status/signed_at/methodology_id) is stamped by the hook. */
export type SignContractInput = {
  instrument: string | null;
  fase: string | null;
  entry_type: string | null;
  risk_pct: number | null;
  signature: string | null;
};

/** The outcome fields filled when a contract is wrapped up. */
export type CloseContractInput = {
  outcome_r: number | null;
  proces_goed: boolean | null;
  note: string | null;
};

/**
 * Owner-only trade-contract data hook (migration 0053). Same shape as
 * useWeeklyReviews: user_id + active-journal (profile.methodology_id) scoping,
 * fetchAllPages past the 1000-row cap, and a requestIdRef guard so a slow
 * response from a previous journal can't land after a newer request.
 */
export function useTradeContracts() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  // Contracts follow the active journal (per-journal isolation, cyclus 3b).
  const activeJournalId = profile?.methodology_id ?? null;
  const [contracts, setContracts] = useState<TradeContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response from a previous journal landing after a newer
  // request and overwriting its contracts (M3 — same pattern as useWeeklyReviews).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // Paginated past the 1000-row cap (H1) with an id tie-breaker for a stable
    // page order. Explicit user_id filter — see useWeeklyReviews.
    const { data, error: fetchError } = await fetchAllPages<TradeContract>((from, to) => {
      let query = supabase.from("trade_contracts").select("*").eq("user_id", userId);
      // Scope to the active journal (cyclus 3b); null = unassigned journal.
      query = activeJournalId ? query.eq("methodology_id", activeJournalId) : query.is("methodology_id", null);
      return query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
    });
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (fetchError) {
      setError(toErrorMessage(fetchError));
    } else {
      setContracts(data as TradeContract[]);
    }
    setLoading(false);
  }, [userId, activeJournalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Sign a new contract (status 'open', signed now), stamped with the active journal. */
  async function signContract(input: SignContractInput): Promise<TradeContract> {
    const { data, error: insertError } = await supabase
      .from("trade_contracts")
      .insert({ ...input, status: "open", signed_at: new Date().toISOString(), methodology_id: activeJournalId })
      .select()
      .single();
    if (insertError) throw insertError;
    await refresh();
    return data as TradeContract;
  }

  /** Wrap up an open contract with its outcome (status 'closed'). */
  async function closeContract(id: string, outcome: CloseContractInput): Promise<TradeContract> {
    const { data, error: updateError } = await supabase
      .from("trade_contracts")
      .update({ ...outcome, status: "closed" })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;
    await refresh();
    return data as TradeContract;
  }

  /** Log a deliberately skipped setup (status 'missed' — a broken keystone). Never signed. */
  async function markMissed(input: SignContractInput): Promise<TradeContract> {
    const { data, error: insertError } = await supabase
      .from("trade_contracts")
      .insert({ ...input, status: "missed", signed_at: null, methodology_id: activeJournalId })
      .select()
      .single();
    if (insertError) throw insertError;
    await refresh();
    return data as TradeContract;
  }

  async function deleteContract(id: string): Promise<void> {
    const { error: deleteError } = await supabase.from("trade_contracts").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  return { contracts, loading, error, refresh, signContract, closeContract, markMissed, deleteContract };
}
