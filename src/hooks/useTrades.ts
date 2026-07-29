import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Trade, TradeInput } from "@/lib/types";

/** A trade either belongs to the live Journal or to exactly one backtest project — never both. */
export type TradeScope = { type: "live" } | { type: "project"; projectId: string };

/** Form-submitted trades never choose their own scope — the page/hook injects it based on context. */
export type TradeSubmitInput = Omit<TradeInput, "backtest_project_id">;

/**
 * Everything useTrades exposes. Pages own exactly one instance per scope and
 * pass it down — two instances of the same scope would each hold their own
 * copy of the data, so a mutation through one would leave the other stale.
 */
export type TradesApi = ReturnType<typeof useTrades>;

export function useTrades(scope: TradeScope) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeKey = scope.type === "live" ? "live" : scope.projectId;
  const loadedScopeRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    // `loading` gates a full-screen "Laden..." that unmounts the whole view. Raise
    // it only until this scope has data on screen — a refetch after create/update/
    // delete swaps the data in place instead, so component state survives (e.g. the
    // month you scrolled the calendar to, which would otherwise snap back to today).
    if (loadedScopeRef.current !== scopeKey) setLoading(true);
    setError(null);
    let query = supabase.from("trades").select("*").order("datum_open", { ascending: true });
    query = scope.type === "live" ? query.is("backtest_project_id", null) : query.eq("backtest_project_id", scope.projectId);
    const { data, error: fetchError } = await query;
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTrades(data as Trade[]);
      loadedScopeRef.current = scopeKey;
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createTrade(input: TradeSubmitInput): Promise<Trade> {
    const backtest_project_id = scope.type === "live" ? null : scope.projectId;
    const { data, error: insertError } = await supabase
      .from("trades")
      .insert({ ...input, backtest_project_id })
      .select()
      .single();
    if (insertError) throw insertError;
    await refresh();
    return data as Trade;
  }

  async function updateTrade(id: string, input: Partial<TradeSubmitInput>): Promise<Trade> {
    const { data, error: updateError } = await supabase.from("trades").update(input).eq("id", id).select().single();
    if (updateError) throw updateError;
    await refresh();
    return data as Trade;
  }

  async function deleteTrade(id: string): Promise<void> {
    const { error: deleteError } = await supabase.from("trades").delete().eq("id", id);
    if (deleteError) throw deleteError;
    await refresh();
  }

  return { trades, loading, error, refresh, createTrade, updateTrade, deleteTrade };
}
