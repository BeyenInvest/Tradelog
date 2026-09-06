import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { isoWeekOf } from "@/lib/isoWeek";
import { toLocalIso, localTodayIso } from "@/lib/localDate";
import { DAILY_HABITS, WEEKLY_HABITS, isFloorMet, type HabitValues } from "@/lib/habits";
import type { HabitDay } from "@/lib/types";

/** How far back we load — enough for the streak, the week view and a strip. */
const LOOKBACK_DAYS = 120;

/**
 * Owner-only habit-tracker data hook (migration 0054). Per-user only — habits
 * are life-level, NOT journal-scoped like useTradeContracts. Follows the same
 * app conventions: useAuth for the session/userId, an explicit user_id filter,
 * fetchAllPages past the 1000-row cap, and a requestIdRef guard so a slow
 * response can't land after a newer request.
 *
 * The single mutation, `toggle`, read-modify-writes the day's `values` jsonb and
 * upserts on (user_id, day) — optimistically, then reconciled by a refresh.
 */
export function useHabits() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [days, setDays] = useState<HabitDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response landing after a newer request (same pattern as useTradeContracts).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // Only the recent window is needed; call at fetch time so a long-lived PWA tab
    // doesn't freeze "today" (M2). yyyy-mm-dd string compares are safe for `date`.
    const since = toLocalIso(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
    const { data, error: fetchError } = await fetchAllPages<HabitDay>((from, to) =>
      supabase
        .from("habit_days")
        .select("*")
        .eq("user_id", userId)
        .gte("day", since)
        .order("day", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (fetchError) {
      setError(toErrorMessage(fetchError));
    } else {
      setDays(data as HabitDay[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** day (yyyy-mm-dd) → its values bag. */
  const daysByDate = useMemo(() => {
    const map = new Map<string, HabitValues>();
    for (const d of days) map.set(d.day, (d.values ?? {}) as HabitValues);
    return map;
  }, [days]);

  /**
   * Mark a habit done/undone on a given day. Read-modify-writes the day's values
   * bag and upserts on (user_id, day). Optimistic — state updates immediately,
   * then a refresh reconciles with the row the DB actually stored.
   */
  const toggle = useCallback(
    async (day: string, habitKey: string, done: boolean) => {
      const prevValues = daysByDate.get(day) ?? {};
      const nextValues: HabitValues = { ...prevValues };
      if (done) nextValues[habitKey] = true;
      else delete nextValues[habitKey];

      // Optimistic: patch the matching row, or add a synthetic one for a fresh day.
      setDays((cur) => {
        const idx = cur.findIndex((d) => d.day === day);
        if (idx >= 0) {
          const next = cur.slice();
          next[idx] = { ...next[idx], values: nextValues };
          return next;
        }
        const optimistic: HabitDay = {
          id: `optimistic-${day}`,
          user_id: userId,
          day,
          values: nextValues,
          created_at: new Date().toISOString(),
        };
        // Keep the descending-by-day order the fetch uses.
        return [optimistic, ...cur].sort((a, b) => (a.day < b.day ? 1 : -1));
      });

      const { error: upsertError } = await supabase
        .from("habit_days")
        .upsert({ user_id: userId, day, values: nextValues }, { onConflict: "user_id,day" });
      if (upsertError) {
        setError(toErrorMessage(upsertError));
      }
      // Reconcile with the server (also replaces the synthetic id with the real row).
      await refresh();
    },
    [daysByDate, userId, refresh]
  );

  // ── Derived helpers the page renders from ──────────────────────────────────

  const today = localTodayIso();
  const todayValues = daysByDate.get(today) ?? {};

  /** How many of the 6 daily habits are done today. */
  const todayDailyDone = useMemo(
    () => DAILY_HABITS.filter((h) => todayValues[h.key] === true).length,
    [todayValues]
  );

  /** Whether today's floor (keystone + journal) is met. */
  const todayFloorMet = isFloorMet(todayValues);

  /** For each weekly habit: how many days in the current ISO week carry its key. */
  const weeklyCounts = useMemo(() => {
    const { jaar, week_nummer } = isoWeekOf(today);
    const counts: Record<string, number> = {};
    for (const h of WEEKLY_HABITS) counts[h.key] = 0;
    for (const [day, values] of daysByDate) {
      const w = isoWeekOf(day);
      if (w.jaar !== jaar || w.week_nummer !== week_nummer) continue;
      for (const h of WEEKLY_HABITS) if (values[h.key] === true) counts[h.key] += 1;
    }
    return counts;
  }, [daysByDate, today]);

  /** Floor-met days in the current ISO week. */
  const weekFloorDays = useMemo(() => {
    const { jaar, week_nummer } = isoWeekOf(today);
    let n = 0;
    for (const [day, values] of daysByDate) {
      const w = isoWeekOf(day);
      if (w.jaar === jaar && w.week_nummer === week_nummer && isFloorMet(values)) n += 1;
    }
    return n;
  }, [daysByDate, today]);

  /**
   * Current streak: consecutive days, counting back from today, whose floor is
   * met. Today not being done yet does NOT break a streak that ran up to
   * yesterday — we start counting from today if done, else from yesterday.
   */
  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date(today + "T00:00:00");
    // If today's floor isn't met yet, the streak is measured up to yesterday.
    if (!isFloorMet(daysByDate.get(today))) cursor.setDate(cursor.getDate() - 1);
    for (;;) {
      const iso = toLocalIso(cursor);
      if (!isFloorMet(daysByDate.get(iso))) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [daysByDate, today]);

  /** Last `n` days (oldest → newest) with their floor state, for the dot strip. */
  const recentFloor = useCallback(
    (n: number): { day: string; floorMet: boolean }[] => {
      const out: { day: string; floorMet: boolean }[] = [];
      const cursor = new Date(today + "T00:00:00");
      cursor.setDate(cursor.getDate() - (n - 1));
      for (let i = 0; i < n; i += 1) {
        const iso = toLocalIso(cursor);
        out.push({ day: iso, floorMet: isFloorMet(daysByDate.get(iso)) });
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    },
    [daysByDate, today]
  );

  return {
    loading,
    error,
    today,
    daysByDate,
    todayValues,
    toggle,
    refresh,
    todayDailyDone,
    todayFloorMet,
    weeklyCounts,
    weekFloorDays,
    streak,
    recentFloor,
  };
}
