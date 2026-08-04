import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Payout, PayoutInput, PropAccount, PropAccountInput } from "@/lib/types";

export function usePropAccounts() {
  const [accounts, setAccounts] = useState<PropAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [accountsRes, payoutsRes] = await Promise.all([
      supabase.from("prop_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").order("datum", { ascending: false }),
    ]);
    if (accountsRes.error) setError(accountsRes.error.message);
    else setAccounts(accountsRes.data as PropAccount[]);
    if (payoutsRes.error) setError(payoutsRes.error.message);
    else setPayouts(payoutsRes.data as Payout[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Mutations below update local state directly from the row Supabase returns, instead of
  // refetching both tables (and re-toggling `loading`, which used to unmount/remount the whole
  // page on every single create/delete — losing in-progress form input and scroll position).

  async function createAccount(input: PropAccountInput): Promise<PropAccount> {
    const { data, error: err } = await supabase.from("prop_accounts").insert(input).select().single();
    if (err) throw err;
    const created = data as PropAccount;
    setAccounts((prev) => [created, ...prev]);
    return created;
  }

  async function updateAccount(id: string, input: Partial<PropAccountInput>): Promise<PropAccount> {
    const { data, error: err } = await supabase.from("prop_accounts").update(input).eq("id", id).select().single();
    if (err) throw err;
    const updated = data as PropAccount;
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }

  async function deleteAccount(id: string): Promise<void> {
    const { error: err } = await supabase.from("prop_accounts").delete().eq("id", id);
    if (err) throw err;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setPayouts((prev) => prev.filter((p) => p.account_id !== id));
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
