import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { useHabits } from "@/hooks/useHabits";
import { DAILY_HABITS, WEEKLY_HABITS, FLOOR_KEYS, type HabitDef } from "@/lib/habits";

/**
 * Owner-only daily habit tracker for the "90-Day Run" (betaFeatures-gated route).
 * A daily-use mobile screen: large tappable checkboxes that save instantly, the
 * non-negotiable FLOOR (keystone + journal) surfaced clearly, weekly-target
 * progress, and a 7-day floor strip. No P&L — it's a habit tracker.
 */
export default function HabitsPage() {
  const { t } = useTranslation();
  const {
    loading,
    error,
    today,
    todayValues,
    toggle,
    todayDailyDone,
    todayFloorMet,
    weeklyCounts,
    weekFloorDays,
    streak,
    recentFloor,
  } = useHabits();

  const strip = recentFloor(7);
  const dailyLabel = (h: HabitDef) => t(h.labelKey, h.label);

  return (
    <>
      <PageHeader title={t("habits.title")} subtitle={t("habits.subtitle")} />

      {error && <p className="text-sm text-loss mb-4">{error}</p>}

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
        {/* Vandaag — the 6 daily habits */}
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
            {DAILY_HABITS.map((h) => (
              <HabitCheckbox
                key={h.key}
                label={dailyLabel(h)}
                checked={todayValues[h.key] === true}
                accent={(FLOOR_KEYS as readonly string[]).includes(h.key)}
                disabled={loading}
                onToggle={(next) => void toggle(today, h.key, next)}
              />
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {/* Deze week — weekly-target habits */}
          <Card className="flex flex-col gap-4">
            <h2 className="font-display text-xl italic text-ink">{t("habits.weekTitle")}</h2>
            <div className="flex flex-col gap-2">
              {WEEKLY_HABITS.map((h) => {
                const done = weeklyCounts[h.key] ?? 0;
                const target = h.target ?? 0;
                const reached = done >= target;
                return (
                  <HabitCheckbox
                    key={h.key}
                    label={dailyLabel(h)}
                    checked={todayValues[h.key] === true}
                    disabled={loading}
                    onToggle={(next) => void toggle(today, h.key, next)}
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

          {/* 7-day floor strip */}
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

/** A large, tappable habit row — the whole row toggles. */
function HabitCheckbox({
  label,
  checked,
  onToggle,
  accent = false,
  disabled = false,
  trailing,
}: {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  accent?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={clsx(
        "flex items-center gap-3 w-full text-left px-3 py-3 rounded-lg border transition-colors disabled:opacity-60",
        checked ? "bg-gold/10 border-gold/50" : "bg-surface-2 border-border hover:border-gold/40"
      )}
    >
      <span
        className={clsx(
          "flex items-center justify-center h-6 w-6 shrink-0 rounded-md border",
          checked ? "bg-gold border-gold text-on-gold" : "border-border text-transparent"
        )}
      >
        <Check size={16} strokeWidth={3} />
      </span>
      <span className={clsx("flex-1 text-sm", accent ? "text-ink font-medium" : "text-ink")}>{label}</span>
      {trailing}
    </button>
  );
}
