import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import type {
  BacktestProject, DailyJournalEntry, Habit, HabitDay, Methodology, MethodologyField, MethodologyView,
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
  if (!id) return { fields: [], isForexJournal: false, trackExit: false };

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
    isForexJournal: methodology?.asset_class === "forex",
    trackExit: methodology?.track_exit === true,
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

/**
 * The viewed user's habit tracker (migrations 0054/0056). Habits are life-level,
 * NOT journal-scoped, so — unlike trades — there's no active-journal filter here;
 * every habit and tick of that user is returned. Needs the is_admin() SELECT
 * carve-out on `habits` + `habit_days` (both added with their own migrations).
 * `habits` includes archived rows so the admin can still see a definition behind
 * historical ticks; the viewer decides what to surface.
 */
export async function getHabitsForUser(userId: string): Promise<{ habits: Habit[]; days: HabitDay[] }> {
  const [habits, days] = await Promise.all([
    allRows<Habit>((from, to) =>
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
    allRows<HabitDay>((from, to) =>
      supabase
        .from("habit_days")
        .select("*")
        .eq("user_id", userId)
        .order("day", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  return { habits, days };
}

/**
 * The viewed user's dagboek entries (migration 0055). Global per user, one row per
 * (user_id, entry_date), newest first. Needs the is_admin() SELECT carve-out on
 * `daily_journal_entries`.
 */
export async function getDailyJournalForUser(userId: string): Promise<DailyJournalEntry[]> {
  return allRows<DailyJournalEntry>((from, to) =>
    supabase
      .from("daily_journal_entries")
      .select("*")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );
}
