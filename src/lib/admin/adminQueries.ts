import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import type {
  BacktestProject, Methodology, MethodologyField, MethodologyView,
  PeriodicReview, Payout, Profile, PropAccount, Trade, WeeklyReview,
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

/**
 * The viewed user's active-journal methodology view for the read-only analysis
 * (H2). Mirrors useMethodology's resolution — the profile's methodology_id, else
 * the built-in Weekly-Phase-Method template — so the admin's Analyse tab renders
 * the *viewed* user's breakdowns (fase/forex/custom-field), not the admin's own.
 * Needs the is_admin() SELECT carve-out on methodologies + methodology_fields
 * (migration 0046); returns a neutral empty view if nothing resolves.
 */
export async function getMethodologyViewForUser(methodologyId: string | null): Promise<MethodologyView> {
  let id = methodologyId;
  if (!id) {
    const { data: sys } = await supabase
      .from("methodologies")
      .select("id")
      .eq("id", WPM_TEMPLATE_METHODOLOGY_ID)
      .maybeSingle();
    id = (sys as { id: string } | null)?.id ?? null;
  }
  if (!id) return { fields: [], isLegacyMethodology: false, isForexJournal: false };

  const [m, fl] = await Promise.all([
    supabase.from("methodologies").select("*").eq("id", id).maybeSingle(),
    supabase.from("methodology_fields").select("*").eq("methodology_id", id).order("sort_order"),
  ]);
  if (m.error) throw m.error;
  if (fl.error) throw fl.error;

  const methodology = (m.data as Methodology | null) ?? null;
  const fields = (fl.data as MethodologyField[] | null) ?? [];
  return {
    fields,
    isLegacyMethodology: fields.some((f) => f.field_key === "fase"),
    isForexJournal: methodology?.asset_class === "forex",
  };
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
