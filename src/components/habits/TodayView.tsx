import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { HabitCheckbox } from "@/components/habits/HabitCheckbox";
import type { useHabits } from "@/hooks/useHabits";
import { DAILY_HABITS, WEEKLY_HABITS, FLOOR_KEYS, type HabitDef } from "@/lib/habits";

/** The daily-use screen: quick ticks for today, the floor, weekly targets, and a 7-day strip. */
export function TodayView({ h }: { h: ReturnType<typeof useHabits> }) {
  const { t } = useTranslation();
  const {
    loading,
    today,
    todayValues,
    toggle,
    todayDailyDone,
    todayFloorMet,
    weeklyCounts,
    weekFloorDays,
    streak,
    recentFloor,
  } = h;

  const strip = recentFloor(7);
  const label = (hb: HabitDef) => t(hb.labelKey, hb.label);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label={t("habits.statStreak")}
          value={t("habits.days", { count: streak })}
          tone={streak > 0 ? "up" : "neutral"}
          compact
        />
        <StatCard
          label={t("habits.statToday")}
          value={`${todayDailyDone}/${DAILY_HABITS.length}`}
          tone={todayFloorMet ? "up" : "neutral"}
          compact
        />
        <StatCard label={t("habits.statWeek")} value={t("habits.days", { count: weekFloorDays })} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl italic text-ink">{t("habits.todayTitle")}</h2>
            <span
              className={clsx(
                "text-xs font-body px-2.5 py-1 rounded-full border",
                todayFloorMet ? "text-win border-win/40 bg-win/10" : "text-muted border-border"
              )}
            >
              {todayFloorMet ? t("habits.floorMet") : t("habits.floorNotMet")}
            </span>
          </div>
          <p className="text-xs text-muted -mt-2">{t("habits.floorHint")}</p>

          <div className="flex flex-col gap-2">
            {DAILY_HABITS.map((hb) => (
              <HabitCheckbox
                key={hb.key}
                label={label(hb)}
                checked={todayValues[hb.key] === true}
                accent={(FLOOR_KEYS as readonly string[]).includes(hb.key)}
                disabled={loading}
                onToggle={(next) => void toggle(today, hb.key, next)}
              />
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-xl italic text-ink">{t("habits.weekTitle")}</h2>
            <div className="flex flex-col gap-2">
              {WEEKLY_HABITS.map((hb) => {
                const done = weeklyCounts[hb.key] ?? 0;
                const target = hb.target ?? 0;
                const reached = done >= target;
                return (
                  <HabitCheckbox
                    key={hb.key}
                    label={label(hb)}
                    checked={todayValues[hb.key] === true}
                    disabled={loading}
                    onToggle={(next) => void toggle(today, hb.key, next)}
                    trailing={
                      <span className={clsx("font-mono text-sm shrink-0", reached ? "text-win" : "text-muted")}>
                        {done}/{target}
                      </span>
                    }
                  />
                );
              })}
            </div>
            <p className="text-xs text-muted">{t("habits.weekHint")}</p>
          </Card>

          <Card padding="sm" className="flex flex-col gap-2">
            <p className="font-body text-xs uppercase tracking-wider text-muted">{t("habits.stripTitle")}</p>
            <div className="flex items-center gap-2">
              {strip.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1">
                  <span
                    title={d.day}
                    className={clsx(
                      "h-6 w-6 rounded-full border",
                      d.floorMet ? "bg-gold border-gold" : "bg-surface-2 border-border"
                    )}
                  />
                  <span className="text-[10px] text-muted">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
