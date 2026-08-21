import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
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
 *
 * All list queries page past PostgREST's silent 1000-row cap (H1) via
 * fetchAllPages, with `.order("id")` as tie-breaker for a stable page order.
 */

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function allRows<T>(page: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const { data, error } = await fetchAllPages(page);
  if (error) throw error;
  return data ?? [];
}

export async function getAllProfiles(): Promise<Profile[]> {
  return allRows<Profile>((from, to) =>
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getTradesForUser(userId: string): Promise<Trade[]> {
  return allRows<Trade>((from, to) =>
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("datum_open", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getWeeklyReviewsForUser(userId: string): Promise<WeeklyReview[]> {
  return allRows<WeeklyReview>((from, to) =>
    supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("jaar", { ascending: false })
      .order("week_nummer", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getPeriodicReviewsForUser(userId: string): Promise<PeriodicReview[]> {
  return allRows<PeriodicReview>((from, to) =>
    supabase
      .from("periodic_reviews")
      .select("*")
      .eq("user_id", userId)
      .order("jaar", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getBacktestProjectsForUser(userId: string): Promise<BacktestProject[]> {
  return allRows<BacktestProject>((from, to) =>
    supabase
      .from("backtest_projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}

export async function getPropAccountsForUser(userId: string): Promise<{ accounts: PropAccount[]; payouts: Payout[] }> {
  const accounts = await allRows<PropAccount>((from, to) =>
    supabase
      .from("prop_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return { accounts, payouts: [] };

  const payouts = await allRows<Payout>((from, to) =>
    supabase
      .from("payouts")
      .select("*")
      .in("account_id", accountIds)
      .order("datum", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );

  return { accounts, payouts };
}
