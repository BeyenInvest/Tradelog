import { supabase } from "@/lib/supabase";
import type {
  BacktestProject, PeriodicReview, Payout, Profile, PropAccount, Trade, WeeklyReview,
} from "@/lib/types";

/**
 * Read-only, explicit `user_id` filters for the admin debug view. Deliberately
 * separate from the owner-scoped hooks (useTrades etc.) — those rely on
 * implicit RLS scoping to auth.uid() and have no read-only mode, so reusing
 * them here would either leak edit affordances or require threading a
 * read-only flag through the whole journal UI. These only work at all
 * because of the `is_admin()` RLS carve-out (supabase/migrations/0008_admin_role.sql) —
 * a non-admin caller gets an empty result, not an error.
 */

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Profile[];
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getTradesForUser(userId: string): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", userId)
    .order("datum_open", { ascending: true });
  if (error) throw error;
  return data as Trade[];
}

export async function getWeeklyReviewsForUser(userId: string): Promise<WeeklyReview[]> {
  const { data, error } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("jaar", { ascending: false })
    .order("week_nummer", { ascending: false });
  if (error) throw error;
  return data as WeeklyReview[];
}

export async function getPeriodicReviewsForUser(userId: string): Promise<PeriodicReview[]> {
  const { data, error } = await supabase
    .from("periodic_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("jaar", { ascending: false });
  if (error) throw error;
  return data as PeriodicReview[];
}

export async function getBacktestProjectsForUser(userId: string): Promise<BacktestProject[]> {
  const { data, error } = await supabase
    .from("backtest_projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BacktestProject[];
}

export async function getPropAccountsForUser(userId: string): Promise<{ accounts: PropAccount[]; payouts: Payout[] }> {
  const { data: accounts, error: accountsError } = await supabase
    .from("prop_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (accountsError) throw accountsError;

  const accountIds = (accounts as PropAccount[]).map((a) => a.id);
  if (accountIds.length === 0) return { accounts: accounts as PropAccount[], payouts: [] };

  const { data: payouts, error: payoutsError } = await supabase
    .from("payouts")
    .select("*")
    .in("account_id", accountIds)
    .order("datum", { ascending: false });
  if (payoutsError) throw payoutsError;

  return { accounts: accounts as PropAccount[], payouts: payouts as Payout[] };
}
