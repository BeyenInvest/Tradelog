import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import type { useHabits } from "@/hooks/useHabits";
import { monthSummary, recentWeekSummaries, bestFloorStreakLastN, type Adherence } from "@/lib/habitStats";

const WEEKS_SHOWN = 8;
const GOAL = 0.8; // the floor target — 80% of days met.

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** Traffic-light classes for a rate against the 80% goal. One source of truth for chart + bars + labels. */
function rateClasses(rate: number): { bar: string; text: string } {
  if (rate >= GOAL) return { bar: "bg-win", text: "text-win" };
  if (rate >= 0.5) return { bar: "bg-gold", text: "text-gold" };
  return { bar: "bg-loss", text: "text-loss" };
}

/** A labelled adherence bar: name · colour-coded fill · percentage · done/total. */
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
        <div className={clsx("h-full rounded-full transition-[width]", c.bar)} style={{ width: pct(a.rate) }} />
      </div>
      <span className={clsx("font-mono text-xs w-10 text-right shrink-0", c.text)}>{pct(a.rate)}</span>
      <span className="hidden sm:inline font-mono text-[11px] text-muted w-10 text-right shrink-0">
        {a.done}/{a.total}
      </span>
    </div>
  );
}

/** Month totals, the weekly floor trend (the zig-zag), and per-habit adherence. */
export function AnalyseView({ h }: { h: ReturnType<typeof useHabits> }) {
  const { t, i18n } = useTranslation();
  const { today, daysByDate, dailyKeys, floorKeys, weeklyDefs, weeklyHabits, dailyHabits, hasFloor } = h;

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const hb of [...dailyHabits, ...weeklyHabits]) m.set(hb.key, hb.label);
    return (key: string) => m.get(key) ?? key;
  }, [dailyHabits, weeklyHabits]);

  const now = useMemo(() => new Date(today + "T00:00:00"), [today]);
  const month = useMemo(
    () => monthSummary(daysByDate, now.getFullYear(), now.getMonth(), today, dailyKeys, floorKeys),
    [daysByDate, now, today, dailyKeys, floorKeys]
  );
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(now),
    [i18n.language, now]
  );
  // Oldest → newest so the trend reads left-to-right in time; the last one is the current (running) week.
  const weeks = useMemo(
    () => recentWeekSummaries(daysByDate, today, WEEKS_SHOWN, floorKeys, weeklyDefs),
    [daysByDate, today, floorKeys, weeklyDefs]
  );
  const bestStreak = useMemo(
    () => bestFloorStreakLastN(daysByDate, today, Math.max(1, month.daysCounted), floorKeys),
    [daysByDate, today, month.daysCounted, floorKeys]
  );

  // Weekly-target adherence is only fair over *completed* weeks — a still-running week can't have hit its target yet.
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

  const weekLabel = (week: number) => t("habits.anWeekLabel", { week });

  const noData = month.daysCounted === 0 && weeks.every((w) => w.floorDays === 0);

  if (noData) {
    return (
      <Card className="flex items-center justify-center py-12">
        <p className="text-sm text-muted">{t("habits.anNoData")}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* This month — the headline numbers */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl italic text-ink capitalize">
          {t("habits.anMonthTitle")} · {monthLabel}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label={t("habits.anFloorRate")} value={pct(month.floor.rate)} tone={month.floor.rate >= GOAL ? "up" : "neutral"} compact />
          <StatCard label={t("habits.anFloorDays")} value={`${month.floorDays}/${month.daysCounted}`} compact />
          <StatCard label={t("habits.anBestStreak")} value={t("habits.days", { count: bestStreak })} compact />
        </div>
        {!hasFloor && <p className="text-xs text-muted">{t("habits.noFloorHint")}</p>}
      </section>

      {/* Weekly floor trend — the hero. The zig-zag (strong weeks then a slide) reads at a glance. */}
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
                    title={`${weekLabel(w.week)} — ${w.floorDays}/${w.daysCounted} (${pct(rate)})`}
                  >
                    <div
                      className={clsx("w-full rounded-t-md transition-[height]", rateClasses(rate).bar, isCurrent && "ring-1 ring-inset ring-ink/15")}
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

          <p className="text-xs text-muted">{t("habits.anWeekHint")}</p>
        </Card>
      )}

      {/* Per-habit adherence — daily habits (this month) and weekly targets (completed weeks) */}
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
    </div>
  );
}
