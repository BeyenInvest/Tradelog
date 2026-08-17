import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { TRADES_MIGRATED_EVENT } from "@/hooks/useMethodology";
import type { Trade, TradeInput } from "@/lib/types";
import type { ImportTradeRow } from "@/lib/import/types";

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
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  // Active journal (cyclus 3b). The live Journal shows only the active journal's
  // trades; a backtest project is orthogonal to journals, so its trades are never
  // journal-filtered. New/imported live trades are stamped with this id below.
  const activeJournalId = profile?.methodology_id ?? null;
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The live scope's key includes the active journal so switching journals refetches.
  const scopeKey = scope.type === "live" ? `live:${activeJournalId ?? "none"}` : scope.projectId;
  const loadedScopeRef = useRef<string | null>(null);
  // Guards against a slow response from a previous scope (e.g. quickly switching
  // between backtest projects) landing after a newer request and overwriting its
  // data — that would silently mix one project's trades into another's view.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    // `loading` gates a full-screen "Laden..." that unmounts the whole view. Raise
    // it only until this scope has data on screen — a refetch after create/update/
    // delete swaps the data in place instead, so component state survives (e.g. the
    // month you scrolled the calendar to, which would otherwise snap back to today).
    if (loadedScopeRef.current !== scopeKey) setLoading(true);
    setError(null);
    // Explicit user_id filter, not left to implicit RLS scoping — an admin account
    // also has a blanket read-all RLS policy (supabase/migrations/0008_admin_role.sql),
    // so an unfiltered query here would return every user's trades on this page.
    let query = supabase.from("trades").select("*").eq("user_id", userId).order("datum_open", { ascending: true });
    if (scope.type === "live") {
      query = query.is("backtest_project_id", null);
      // Scope the live Journal to the active journal (cyclus 3b). null = an
      // unassigned journal; match its rows rather than every journal's.
      query = activeJournalId ? query.eq("methodology_id", activeJournalId) : query.is("methodology_id", null);
    } else {
      query = query.eq("backtest_project_id", scope.projectId);
    }
    const { data, error: fetchError } = await query;
    if (requestId !== requestIdRef.current) return; // a newer request has since superseded this one
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setTrades(data as Trade[]);
      loadedScopeRef.current = scopeKey;
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // An option-rename migration (useMethodology.renameFieldOption) rewrites
  // trades.custom server-side, outside this hook's mutations — refetch so the
  // in-memory rows (list, Analyse buckets) pick up the new value immediately.
  useEffect(() => {
    const onMigrated = () => void refresh();
    window.addEventListener(TRADES_MIGRATED_EVENT, onMigrated);
    return () => window.removeEventListener(TRADES_MIGRATED_EVENT, onMigrated);
  }, [refresh]);

  async function createTrade(input: TradeSubmitInput): Promise<Trade> {
    const backtest_project_id = scope.type === "live" ? null : scope.projectId;
    // A live trade belongs to the active journal (cyclus 3b). The form already sets
    // methodology_id, but default it here too so it's never left unscoped.
    const methodology_id = scope.type === "live" ? input.methodology_id ?? activeJournalId : input.methodology_id;
    const { data, error: insertError } = await supabase
      .from("trades")
      .insert({ ...input, backtest_project_id, methodology_id })
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

  /**
   * Bulk-insert imported broker trades in one round-trip. Rows already carry
   * their import_ref (the dedup key); the DB's partial unique index
   * (trades_user_import_ref_unique) is the last line of defence against a
   * double-import that slipped past the client-side dedup. Returns how many rows
   * were inserted. The scope decides where rows land: the live Journal's active
   * journal, or a backtest project (TradingView backtest imports, Fase I).
   */
  async function createTradesBulk(rows: ImportTradeRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const backtest_project_id = scope.type === "live" ? null : scope.projectId;
    // Imported rows carry methodology_id: null — stamp the active journal so live
    // imports land in (and stay visible in) the active journal (cyclus 3b).
    const methodology_id = scope.type === "live" ? activeJournalId : null;
    const payload = rows.map((r) => ({ ...r, backtest_project_id, methodology_id }));
    const { data, error: insertError } = await supabase.from("trades").insert(payload).select("id");
    if (insertError) throw insertError;
    await refresh();
    return data?.length ?? 0;
  }

  return { trades, loading, error, refresh, createTrade, updateTrade, deleteTrade, createTradesBulk };
}
