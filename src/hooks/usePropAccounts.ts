import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { Payout, PayoutInput, PropAccount, PropAccountInput } from "@/lib/types";

/**
 * Fired after an account mutation (create/update/delete). ResultDisplayProvider
 * listens and re-fetches its saldo, so geld-modus bedragen nooit op een oud
 * account_size blijven rekenen. Window event, zoals TRADES_MIGRATED_EVENT:
 * de provider heeft geen handle op deze hook-instantie.
 */
export const PROP_ACCOUNTS_CHANGED_EVENT = "beyen:prop-accounts-changed";

function notifyAccountsChanged() {
  window.dispatchEvent(new CustomEvent(PROP_ACCOUNTS_CHANGED_EVENT));
}

export function usePropAccounts() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  // Accounts follow the active journal (per-journal isolation, cyclus 3b).
  const activeJournalId = profile?.methodology_id ?? null;
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response from a previous journal landing after a newer
  // request and overwriting its accounts (M3 — same pattern as useTrades).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // Paginated past the 1000-row cap (H1) with an id tie-breaker — see
    // fetchAllPages. Explicit user_id filter on accounts — see useTrades for why
    // this can't be left to RLS alone. Payouts has no user_id of its own, so it's
    // scoped indirectly via account_id once we know which accounts are ours (same
    // pattern as adminQueries.getPropAccountsForUser).
    const accountsRes = await fetchAllPages<PropAccount>((from, to) => {
      let accountsQuery = supabase.from("prop_accounts").select("*").eq("user_id", userId);
      // Scope to the active journal (cyclus 3b); null = unassigned journal.
      accountsQuery = activeJournalId ? accountsQuery.eq("methodology_id", activeJournalId) : accountsQuery.is("methodology_id", null);
      return accountsQuery.order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to);
    });
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (accountsRes.error) {
      setError(toErrorMessage(accountsRes.error));
      setLoading(false);
      return;
    }
    const accounts = accountsRes.data as PropAccount[];
    setAccounts(accounts);

    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      setPayouts([]);
      setLoading(false);
      return;
    }
    const payoutsRes = await fetchAllPages<Payout>((from, to) =>
      supabase
        .from("payouts")
        .select("*")
        .in("account_id", accountIds)
        .order("datum", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (payoutsRes.error) setError(toErrorMessage(payoutsRes.error));
    else setPayouts(payoutsRes.data as Payout[]);
    setLoading(false);
  }, [userId, activeJournalId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Mutations below update local state directly from the row Supabase returns, instead of
  // refetching both tables (and re-toggling `loading`, which used to unmount/remount the whole
  // page on every single create/delete — losing in-progress form input and scroll position).

  async function createAccount(input: PropAccountInput): Promise<PropAccount> {
    // Stamp the active journal so the account lands in (and stays visible in) it (cyclus 3b).
    const { data, error: err } = await supabase
      .from("prop_accounts")
      .insert({ ...input, methodology_id: activeJournalId })
      .select()
      .single();
    if (err) throw err;
    const created = data as PropAccount;
    setAccounts((prev) => [created, ...prev]);
    notifyAccountsChanged();
    return created;
  }

  async function updateAccount(id: string, input: Partial<PropAccountInput>): Promise<PropAccount> {
    const { data, error: err } = await supabase.from("prop_accounts").update(input).eq("id", id).select().single();
    if (err) throw err;
    const updated = data as PropAccount;
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    notifyAccountsChanged();
    return updated;
  }

  async function deleteAccount(id: string): Promise<void> {
    const { error: err } = await supabase.from("prop_accounts").delete().eq("id", id);
    if (err) throw err;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setPayouts((prev) => prev.filter((p) => p.account_id !== id));
    notifyAccountsChanged();
  }

  async function createPayout(input: PayoutInput): Promise<Payout> {
    const { data, error: err } = await supabase.from("payouts").insert(input).select().single();
    if (err) throw err;
    const created = data as Payout;
    setPayouts((prev) => [...prev, created].sort((a, b) => b.datum.localeCompare(a.datum)));
    return created;
  }

  async function deletePayout(id: string): Promise<void> {
    const { error: err } = await supabase.from("payouts").delete().eq("id", id);
    if (err) throw err;
    setPayouts((prev) => prev.filter((p) => p.id !== id));
  }

  return { accounts, payouts, loading, error, refresh, createAccount, updateAccount, deleteAccount, createPayout, deletePayout };
}
