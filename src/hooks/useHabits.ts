import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAllPages } from "@/lib/fetchAll";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { isoWeekOf } from "@/lib/isoWeek";
import { toLocalIso, localTodayIso } from "@/lib/localDate";
import { isFloorMet, type HabitValues } from "@/lib/habits";
import type { WeeklyDef } from "@/lib/habitStats";
import type { Habit, HabitDay, HabitInput } from "@/lib/types";

/** How far back we load — enough for the streak, the week view and a strip. */
const LOOKBACK_DAYS = 120;

/**
 * Owner/beta habit-tracker data hook (migrations 0054 + 0056). Per-user only —
 * habits are life-level, NOT journal-scoped. Since 0056 the habit *definitions*
 * are user-owned rows the user builds on the Habits page, so this hook loads two
 * things: the `habits` config (the list) and `habit_days` (the ticks), and exposes
 * both the derived day-stats and CRUD to edit the list.
 *
 * `toggle` read-modify-writes a day's `values` bag (keyed by habit key) and upserts
 * on (user_id, day) — optimistically, then reconciled by a refresh.
 */
export function useHabits() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [days, setDays] = useState<HabitDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response landing after a newer request.
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    // Only the recent window of ticks is needed; call at fetch time so a long-lived
    // PWA tab doesn't freeze "today" (M2). yyyy-mm-dd string compares are safe for `date`.
    const since = toLocalIso(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
    const [habitsRes, daysRes] = await Promise.all([
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      fetchAllPages<HabitDay>((from, to) =>
        supabase
          .from("habit_days")
          .select("*")
          .eq("user_id", userId)
          .gte("day", since)
          .order("day", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to)
      ),
    ]);
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (habitsRes.error || daysRes.error) {
      setError(toErrorMessage(habitsRes.error ?? daysRes.error));
    } else {
      setHabits((habitsRes.data ?? []) as Habit[]);
      setDays((daysRes.data ?? []) as HabitDay[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Habit definitions, split by tier ───────────────────────────────────────
  const dailyHabits = useMemo(() => habits.filter((h) => h.tier === "daily"), [habits]);
  const weeklyHabits = useMemo(() => habits.filter((h) => h.tier === "weekly"), [habits]);
  const dailyKeys = useMemo(() => dailyHabits.map((h) => h.key), [dailyHabits]);
  const floorKeys = useMemo(() => habits.filter((h) => h.is_floor).map((h) => h.key), [habits]);
  const weeklyDefs = useMemo<WeeklyDef[]>(() => weeklyHabits.map((h) => ({ key: h.key, target: h.target })), [weeklyHabits]);
  const hasHabits = habits.length > 0;
  const hasFloor = floorKeys.length > 0;

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
        return [optimistic, ...cur].sort((a, b) => (a.day < b.day ? 1 : -1));
      });

      const { error: upsertError } = await supabase
        .from("habit_days")
        .upsert({ user_id: userId, day, values: nextValues }, { onConflict: "user_id,day" });
      if (upsertError) setError(toErrorMessage(upsertError));
      await refresh();
    },
    [daysByDate, userId, refresh]
  );

  // ── Habit CRUD (the builder) ───────────────────────────────────────────────

  /** Add a habit to the end of the list. A fresh random `key` is generated so ticks stay stable across renames. */
  const addHabit = useCallback(
    async (input: HabitInput) => {
      const key = crypto.randomUUID();
      const sortOrder = habits.reduce((max, h) => Math.max(max, h.sort_order), -1) + 1;
      const { error: insertError } = await supabase.from("habits").insert({
        user_id: userId,
        key,
        label: input.label,
        tier: input.tier,
        target: input.tier === "weekly" ? input.target : null,
        is_floor: input.is_floor,
        sort_order: sortOrder,
      });
      if (insertError) throw insertError;
      await refresh();
    },
    [habits, userId, refresh]
  );

  const updateHabit = useCallback(
    async (id: string, patch: Partial<HabitInput>) => {
      // Keep target coherent with tier: a daily habit never carries a target.
      const clean = { ...patch };
      if (clean.tier === "daily") clean.target = null;
      const { error: updateError } = await supabase.from("habits").update(clean).eq("id", id);
      if (updateError) throw updateError;
      await refresh();
    },
    [refresh]
  );

  /** Soft-delete: archive so historical ticks in habit_days stay intact and untouched. */
  const deleteHabit = useCallback(
    async (id: string) => {
      const { error: delError } = await supabase.from("habits").update({ archived: true }).eq("id", id);
      if (delError) throw delError;
      await refresh();
    },
    [refresh]
  );

  /** Move a habit up/down among its same-tier siblings by swapping sort_order. */
  const moveHabit = useCallback(
    async (id: string, dir: -1 | 1) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      const siblings = habits.filter((h) => h.tier === target.tier);
      const idx = siblings.findIndex((h) => h.id === id);
      const swapWith = siblings[idx + dir];
      if (!swapWith) return;
      // Optimistic reorder for a snappy feel; refresh reconciles.
      setHabits((cur) =>
        cur.map((h) => {
          if (h.id === target.id) return { ...h, sort_order: swapWith.sort_order };
          if (h.id === swapWith.id) return { ...h, sort_order: target.sort_order };
          return h;
        })
      );
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from("habits").update({ sort_order: swapWith.sort_order }).eq("id", target.id),
        supabase.from("habits").update({ sort_order: target.sort_order }).eq("id", swapWith.id),
      ]);
      if (e1 || e2) setError(toErrorMessage(e1 ?? e2));
      await refresh();
    },
    [habits, refresh]
  );

  // ── Derived day-stats (all keyed off the user's own definitions) ────────────

  const today = localTodayIso();
  const todayValues = daysByDate.get(today) ?? {};

  const todayDailyDone = useMemo(() => dailyKeys.filter((k) => todayValues[k] === true).length, [dailyKeys, todayValues]);

  const todayFloorMet = isFloorMet(todayValues, floorKeys);

  /** For each weekly habit: how many days in the current ISO week carry its key. */
  const weeklyCounts = useMemo(() => {
    const { jaar, week_nummer } = isoWeekOf(today);
    const counts: Record<string, number> = {};
    for (const h of weeklyHabits) counts[h.key] = 0;
    for (const [day, values] of daysByDate) {
      const w = isoWeekOf(day);
      if (w.jaar !== jaar || w.week_nummer !== week_nummer) continue;
      for (const h of weeklyHabits) if (values[h.key] === true) counts[h.key] += 1;
    }
    return counts;
  }, [daysByDate, today, weeklyHabits]);

  /** Floor-met days in the current ISO week. */
  const weekFloorDays = useMemo(() => {
    const { jaar, week_nummer } = isoWeekOf(today);
    let n = 0;
    for (const [day, values] of daysByDate) {
      const w = isoWeekOf(day);
      if (w.jaar === jaar && w.week_nummer === week_nummer && isFloorMet(values, floorKeys)) n += 1;
    }
    return n;
  }, [daysByDate, today, floorKeys]);

  /**
   * Current streak: consecutive floor-met days counting back from today. Today
   * not being done yet does NOT break a streak that ran up to yesterday.
   */
  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date(today + "T00:00:00");
    if (!isFloorMet(daysByDate.get(today), floorKeys)) cursor.setDate(cursor.getDate() - 1);
    for (;;) {
      const iso = toLocalIso(cursor);
      if (!isFloorMet(daysByDate.get(iso), floorKeys)) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [daysByDate, today, floorKeys]);

  /** Last `n` days (oldest → newest) with their floor state, for the dot strip. */
  const recentFloor = useCallback(
    (n: number): { day: string; floorMet: boolean }[] => {
      const out: { day: string; floorMet: boolean }[] = [];
      const cursor = new Date(today + "T00:00:00");
      cursor.setDate(cursor.getDate() - (n - 1));
      for (let i = 0; i < n; i += 1) {
        const iso = toLocalIso(cursor);
        out.push({ day: iso, floorMet: isFloorMet(daysByDate.get(iso), floorKeys) });
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    },
    [daysByDate, today, floorKeys]
  );

  return {
    loading,
    error,
    today,
    daysByDate,
    todayValues,
    toggle,
    refresh,
    // definitions
    habits,
    dailyHabits,
    weeklyHabits,
    dailyKeys,
    floorKeys,
    weeklyDefs,
    hasHabits,
    hasFloor,
    // builder
    addHabit,
    updateHabit,
    deleteHabit,
    moveHabit,
    // day stats
    todayDailyDone,
    todayFloorMet,
    weeklyCounts,
    weekFloorDays,
    streak,
    recentFloor,
  };
}
