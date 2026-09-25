import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Check, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { isFloorMet, type HabitValues } from "@/lib/habits";
import {
  monthSummary, recentWeekSummaries, bestFloorStreakLastN, type Adherence, type DaysByDate,
} from "@/lib/habitStats";
import { localTodayIso } from "@/lib/localDate";
import type { Habit, HabitDay } from "@/lib/types";

/**
 * Read-only mirror of the members' Habits → Analyse view for the admin debug page.
 * Deliberately self-contained (like the other ReadOnly* admin components and
 * adminQueries): it takes another user's raw `habits` + `habit_days` rows and
 * renders the same numbers by reusing the pure functions in habitStats.ts, so no
 * stats logic is duplicated and no member-facing (frozen) Habits component is
 * touched. Nothing here writes — the admin only ever looks.
 *
 * Both tables are life-level (not journal-scoped), so what's shown is the whole
 * person's habit history, independent of which journal they had active.
 */

const WEEKS_SHOWN = 8;
const GOAL = 0.8; // floor target — 80% of days met (mirrors AnalyseView).

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Traffic-light classes for a rate against the 80% goal — same thresholds as AnalyseView. */
function rateClasses(rate: number): { bar: string; text: string } {
  if (rate >= GOAL) return { bar: "bg-win", text: "text-win" };
  if (rate >= 0.5) return { bar: "bg-gold", text: "text-gold" };
  return { bar: "bg-loss", text: "text-loss" };
}

/** yyyy-mm-dd for a calendar cell — local, no timezone drift. */
function cellIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Read-only month calendar for the admin habits tab — a look-only mirror of the
 * members' CalendarView. The grid shows per-day floor state (gold) and the daily
 * count; picking a day lists exactly which habits were ticked that day. Nothing
 * toggles: an admin only reads.
 */
function ReadOnlyHabitCalendar({
  daysByDate, today, dailyHabits, weeklyHabits, floorKeys, hasFloor,
}: {
  daysByDate: DaysByDate;
  today: string;
  dailyHabits: Habit[];
  weeklyHabits: Habit[];
  floorKeys: string[];
  hasFloor: boolean;
}) {
  const { t, i18n } = useTranslation();
  const now = useMemo(() => new Date(today + "T00:00:00"), [today]);
  const [view, setView] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string>(today);

  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const dayHabits = useMemo(() => [...dailyHabits, ...weeklyHabits], [dailyHabits, weeklyHabits]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(new Date(view.year, view.month, 1)),
    [i18n.language, view]
  );

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [i18n.language]);

  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const lead = (first.getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(cellIso(view.year, view.month, d));
    return out;
  }, [view]);

  const goMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const selectedValues = daysByDate.get(selected) ?? {};
  const selectedFloor = isFloorMet(selectedValues, floorKeys);
  const selectedFuture = selected > today;
  const selectedLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(selected + "T00:00:00"));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            aria-label={t("habits.calPrevMonth")}
            className="h-8 w-8 grid place-items-center rounded-lg border border-border text-muted hover:border-gold/40 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </button>
          <h3 className="font-display text-xl italic text-ink capitalize">{monthLabel}</h3>
          <button
            type="button"
            onClick={() => goMonth(1)}
            disabled={atCurrentMonth}
            aria-label={t("habits.calNextMonth")}
            className="h-8 w-8 grid place-items-center rounded-lg border border-border text-muted hover:border-gold/40 hover:text-ink disabled:opacity-30 disabled:hover:border-border disabled:hover:text-muted"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekdayLabels.map((w, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-wide text-muted py-1 capitalize">
              {w}
            </div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} />;
            const values = daysByDate.get(iso);
            const floor = isFloorMet(values, floorKeys);
            const dailyDone = dailyHabits.filter((hb) => values?.[hb.key] === true).length;
            const isToday = iso === today;
            const isFuture = iso > today;
            const isSelected = iso === selected;
            const dayNum = Number(iso.slice(8));
            return (
              <button
                key={iso}
                type="button"
                disabled={isFuture}
                onClick={() => setSelected(iso)}
                aria-label={`${iso}${floor ? " ✓" : ""}`}
                aria-pressed={isSelected}
                className={clsx(
                  "aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors",
                  isFuture && "opacity-30 cursor-not-allowed border-border",
                  !isFuture && floor && "bg-gold/15 border-gold text-ink",
                  !isFuture && !floor && dailyDone > 0 && "border-gold/40 text-ink",
                  !isFuture && !floor && dailyDone === 0 && "border-border text-muted hover:border-gold/40",
                  isToday && "ring-2 ring-gold/60",
                  isSelected && "ring-2 ring-ink"
                )}
              >
                <span className={clsx("text-sm leading-none", floor && "font-semibold")}>{dayNum}</span>
                {!isFuture && dailyDone > 0 && dailyHabits.length > 0 && (
                  <span className="text-[9px] leading-none text-muted">{dailyDone}/{dailyHabits.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {hasFloor && (
          <div className="flex items-center gap-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-gold/15 border border-gold" /> {t("habits.calLegendFloor")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border border-gold/40" /> {t("habits.calLegendPartial")}
            </span>
          </div>
        )}
      </Card>

      {/* Selected day — which habits were ticked (read-only) */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-xl italic text-ink capitalize">{selectedLabel}</h3>
          {!selectedFuture && hasFloor && (
            <span
              className={clsx(
                "text-xs font-body px-2.5 py-1 rounded-full border shrink-0",
                selectedFloor ? "text-win border-win/40 bg-win/10" : "text-muted border-border"
              )}
            >
              {selectedFloor ? t("habits.floorMet") : t("habits.floorNotMet")}
            </span>
          )}
        </div>

        {selectedFuture ? (
          <p className="text-sm text-muted">{t("habits.calFutureHint")}</p>
        ) : dayHabits.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.habitsNoConfig")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayHabits.map((hb) => {
              const done = selectedValues[hb.key] === true;
              return (
                <div
                  key={hb.key}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
                    done ? "border-gold/40 bg-gold/5 text-ink" : "border-border text-muted"
                  )}
                >
                  <span
                    className={clsx(
                      "h-5 w-5 grid place-items-center rounded shrink-0",
                      done ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"
                    )}
                  >
                    {done ? <Check size={13} /> : <Minus size={13} />}
                  </span>
                  <span className="flex-1 truncate">{hb.label}</span>
                  {hb.is_floor && (
                    <span className="font-mono text-[10px] text-gold px-1.5 py-0.5 rounded bg-gold/10 shrink-0">
                      {t("habits.builderFloorBadge")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdherenceRow({ label, a, targetBadge }: { label: string; a: Adherence; targetBadge?: string }) {
  const c = rateClasses(a.rate);
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 sm:w-44 shrink-0 flex items-center gap-1.5 min-w-0">
        <span className="text-sm text-ink truncate">{label}</span>
        {targetBadge && (
          <span className="shrink-0 font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface-2">{targetBadge}</span>
        )}
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
        <div className={clsx("h-full rounded-full", c.bar)} style={{ width: pct(a.rate) }} />
      </div>
      <span className={clsx("font-mono text-xs w-10 text-right shrink-0", c.text)}>{pct(a.rate)}</span>
      <span className="hidden sm:inline font-mono text-[11px] text-muted w-10 text-right shrink-0">
        {a.done}/{a.total}
      </span>
    </div>
  );
}

export function ReadOnlyHabitsViewer({ habits, days }: { habits: Habit[]; days: HabitDay[] }) {
  const { t, i18n } = useTranslation();

  // Show archived definitions too (dimmed) so a tick history isn't left unexplained,
  // but drive the stats off the same active/tier/floor split the member hook uses.
  const active = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const dailyHabits = useMemo(() => active.filter((h) => h.tier === "daily"), [active]);
  const weeklyHabits = useMemo(() => active.filter((h) => h.tier === "weekly"), [active]);
  const dailyKeys = useMemo(() => dailyHabits.map((h) => h.key), [dailyHabits]);
  const floorKeys = useMemo(() => active.filter((h) => h.is_floor).map((h) => h.key), [active]);
  const weeklyDefs = useMemo(() => weeklyHabits.map((h) => ({ key: h.key, target: h.target })), [weeklyHabits]);
  const hasFloor = floorKeys.length > 0;

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of habits) m.set(h.key, h.label);
    return (key: string) => m.get(key) ?? key;
  }, [habits]);

  const daysByDate = useMemo<DaysByDate>(() => {
    const m = new Map<string, HabitValues>();
    for (const d of days) m.set(d.day, (d.values ?? {}));
    return m;
  }, [days]);

  const today = localTodayIso();
  const now = useMemo(() => new Date(today + "T00:00:00"), [today]);
  const month = useMemo(
    () => monthSummary(daysByDate, now.getFullYear(), now.getMonth(), today, dailyKeys, floorKeys),
    [daysByDate, now, today, dailyKeys, floorKeys]
  );
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(now),
    [i18n.language, now]
  );
  const weeks = useMemo(
    () => recentWeekSummaries(daysByDate, today, WEEKS_SHOWN, floorKeys, weeklyDefs),
    [daysByDate, today, floorKeys, weeklyDefs]
  );
  const bestStreak = useMemo(
    () => bestFloorStreakLastN(daysByDate, today, Math.max(1, month.daysCounted), floorKeys),
    [daysByDate, today, month.daysCounted, floorKeys]
  );

  const completedWeeks = useMemo(() => weeks.filter((w) => w.daysCounted >= 7), [weeks]);
  const weeklyAdherence: Adherence[] = useMemo(
    () =>
      weeklyHabits.map((hb) => {
        const total = completedWeeks.length;
        const done = completedWeeks.filter((w) => w.weekly.find((x) => x.key === hb.key)?.reached).length;
        return { key: hb.key, done, total, rate: total ? done / total : 0 };
      }),
    [completedWeeks, weeklyHabits]
  );

  // Last 14 days floor strip — a quick "are they keeping it up" glance for the admin.
  const strip = useMemo(() => {
    const out: { day: string; floorMet: boolean }[] = [];
    const cursor = new Date(today + "T00:00:00");
    cursor.setDate(cursor.getDate() - 13);
    for (let i = 0; i < 14; i += 1) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const iso = `${y}-${m}-${d}`;
      out.push({ day: iso, floorMet: isFloorMet(daysByDate.get(iso), floorKeys) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [daysByDate, today, floorKeys]);

  if (habits.length === 0 && days.length === 0) {
    return (
      <Card className="flex items-center justify-center py-12">
        <p className="text-sm text-muted">{t("admin.habitsNoData")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* This month — headline numbers */}
      <section className="flex flex-col gap-4">
        <h3 className="font-display text-xl italic text-ink capitalize">
          {t("habits.anMonthTitle")} · {monthLabel}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label={t("habits.anFloorRate")} value={pct(month.floor.rate)} tone={month.floor.rate >= GOAL ? "up" : "neutral"} compact />
          <StatCard label={t("habits.anFloorDays")} value={`${month.floorDays}/${month.daysCounted}`} compact />
          <StatCard label={t("habits.anBestStreak")} value={t("habits.days", { count: bestStreak })} compact />
        </div>
        {!hasFloor && <p className="text-xs text-muted">{t("habits.noFloorHint")}</p>}
      </section>

      {/* Day by day — the calendar */}
      <section className="flex flex-col gap-3">
        <h3 className="font-body text-xs uppercase tracking-wider text-muted">{t("admin.habitsCalendarTitle")}</h3>
        <ReadOnlyHabitCalendar
          daysByDate={daysByDate}
          today={today}
          dailyHabits={dailyHabits}
          weeklyHabits={weeklyHabits}
          floorKeys={floorKeys}
          hasFloor={hasFloor}
        />
      </section>

      {/* Recent 14-day floor strip */}
      {hasFloor && (
        <Card className="flex flex-col gap-3">
          <p className="font-body text-xs uppercase tracking-wider text-muted">{t("admin.habitsRecentStrip")}</p>
          <div className="flex gap-1.5">
            {strip.map((s) => (
              <span
                key={s.day}
                title={s.day}
                className={clsx("h-6 flex-1 rounded", s.floorMet ? "bg-win" : "bg-surface-2")}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Weekly floor trend (the zig-zag) */}
      {hasFloor && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-body text-xs uppercase tracking-wider text-muted">{t("habits.anTrendTitle")}</p>
            <span className="font-mono text-[10px] text-gold/80">{t("habits.anGoalLabel")} {pct(GOAL)}</span>
          </div>
          <div className="relative h-44 border-b border-border">
            <div className="absolute inset-x-0 border-t border-dashed border-gold/40" style={{ bottom: pct(GOAL) }} />
            <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
              {weeks.map((w, i) => {
                const rate = w.daysCounted ? w.floorDays / w.daysCounted : 0;
                const isCurrent = i === weeks.length - 1;
                return (
                  <div
                    key={`${w.jaar}-${w.week}`}
                    className="flex-1 flex flex-col justify-end h-full min-w-0"
                    title={`${t("habits.anWeekLabel", { week: w.week })} — ${w.floorDays}/${w.daysCounted} (${pct(rate)})`}
                  >
                    <div
                      className={clsx("w-full rounded-t-md", rateClasses(rate).bar, isCurrent && "ring-1 ring-inset ring-ink/15")}
                      style={{ height: `${Math.max(rate * 100, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            {weeks.map((w, i) => (
              <span
                key={`${w.jaar}-${w.week}`}
                className={clsx("flex-1 text-center text-[10px] font-mono truncate min-w-0", i === weeks.length - 1 ? "text-ink" : "text-muted")}
              >
                {w.week}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Per-habit adherence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dailyHabits.length > 0 && (
          <Card className="flex flex-col gap-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted">{t("habits.anDailyTitle")}</p>
            <div className="flex flex-col gap-3">
              {month.daily.map((a) => (
                <AdherenceRow key={a.key} label={labelOf(a.key)} a={a} />
              ))}
            </div>
          </Card>
        )}

        {weeklyHabits.length > 0 && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-body text-xs uppercase tracking-wider text-muted">{t("habits.anWeeklyTitle")}</p>
              {completedWeeks.length > 0 && (
                <span className="font-mono text-[10px] text-muted">{t("habits.anOverWeeks", { count: completedWeeks.length })}</span>
              )}
            </div>
            {completedWeeks.length === 0 ? (
              <p className="text-sm text-muted">{t("habits.anNoCompletedWeeks")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {weeklyAdherence.map((a) => {
                  const def = weeklyHabits.find((hb) => hb.key === a.key);
                  return (
                    <AdherenceRow
                      key={a.key}
                      label={labelOf(a.key)}
                      a={a}
                      targetBadge={def?.target ? t("habits.anPerWeek", { count: def.target }) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* The user's habit definitions — the config behind the numbers */}
      <Card className="flex flex-col gap-3">
        <p className="font-body text-xs uppercase tracking-wider text-muted">{t("admin.habitsConfig")}</p>
        {habits.length === 0 ? (
          <p className="text-sm text-muted">{t("admin.habitsNoConfig")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {habits.map((h) => (
              <li key={h.id} className={clsx("flex items-center gap-3 py-2 text-sm", h.archived && "opacity-45")}>
                <span className="flex-1 text-ink truncate">{h.label}</span>
                <span className="font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface-2">
                  {h.tier === "weekly" ? t("habits.builderTierWeekly") : t("habits.builderTierDaily")}
                </span>
                {h.tier === "weekly" && h.target ? (
                  <span className="font-mono text-[10px] text-muted">{t("habits.anPerWeek", { count: h.target })}</span>
                ) : null}
                {h.is_floor && (
                  <span className="font-mono text-[10px] text-gold px-1.5 py-0.5 rounded bg-gold/10">{t("habits.builderFloorBadge")}</span>
                )}
                {h.archived && (
                  <span className="font-mono text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface-2">{t("admin.habitsArchived")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
