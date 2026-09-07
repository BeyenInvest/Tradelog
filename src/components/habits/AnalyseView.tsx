import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import type { useHabits } from "@/hooks/useHabits";
import { DAILY_HABITS, WEEKLY_HABITS, type HabitDef } from "@/lib/habits";
import { monthSummary, recentWeekSummaries, bestFloorStreakLastN, type Adherence } from "@/lib/habitStats";

const WEEKS_SHOWN = 8;

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** A thin adherence bar: label on the left, done/total + gold fill. */
function AdherenceRow({ label, a }: { label: string; a: Adherence }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 text-sm text-ink truncate">{label}</span>
      <div className="w-28 sm:w-36 h-2 rounded-full bg-surface-2 overflow-hidden shrink-0">
        <div className="h-full bg-gold rounded-full" style={{ width: pct(a.rate) }} />
      </div>
      <span className="font-mono text-xs text-muted w-14 text-right shrink-0">
        {a.done}/{a.total}
      </span>
    </div>
  );
}

/** Month totals + the per-week zig-zag view — where the "3 strong weeks then collapse" pattern shows. */
export function AnalyseView({ h }: { h: ReturnType<typeof useHabits> }) {
  const { t, i18n } = useTranslation();
  const { today, daysByDate } = h;

  const now = useMemo(() => new Date(today + "T00:00:00"), [today]);
  const month = useMemo(
    () => monthSummary(daysByDate, now.getFullYear(), now.getMonth(), today),
    [daysByDate, now, today]
  );
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(now),
    [i18n.language, now]
  );
  const weeks = useMemo(
    () => recentWeekSummaries(daysByDate, today, WEEKS_SHOWN).reverse(), // newest first for the list
    [daysByDate, today]
  );
  const bestStreak = useMemo(
    () => bestFloorStreakLastN(daysByDate, today, Math.max(1, month.daysCounted)),
    [daysByDate, today, month.daysCounted]
  );

  const keystone = month.daily.find((a) => a.key === "keystone");
  const label = (key: string) => {
    const def = [...DAILY_HABITS, ...WEEKLY_HABITS].find((hb: HabitDef) => hb.key === key);
    return def ? t(def.labelKey, def.label) : key;
  };
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }).format(new Date(iso + "T00:00:00"));

  const empty = month.daysCounted > 0 && month.floorDays === 0 && weeks.every((w) => w.floorDays === 0 && w.keystoneDays === 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Deze maand */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl italic text-ink capitalize">
          {t("habits.anMonthTitle")} · {monthLabel}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t("habits.anFloorRate")} value={pct(month.floor.rate)} tone={month.floor.rate >= 0.8 ? "up" : "neutral"} compact />
          <StatCard label={t("habits.anKeystoneRate")} value={keystone ? pct(keystone.rate) : "—"} tone={keystone && keystone.rate >= 0.8 ? "up" : "neutral"} compact />
          <StatCard label={t("habits.anFloorDays")} value={`${month.floorDays}/${month.daysCounted}`} compact />
          <StatCard label={t("habits.anBestStreak")} value={t("habits.days", { count: bestStreak })} compact />
        </div>

        <Card className="flex flex-col gap-3">
          <p className="font-body text-xs uppercase tracking-wider text-muted">{t("habits.anAdherenceTitle")}</p>
          {empty ? (
            <p className="text-sm text-muted">{t("habits.anNoData")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {month.daily.map((a) => (
                <AdherenceRow key={a.key} label={label(a.key)} a={a} />
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* Per week — the zig-zag */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl italic text-ink">{t("habits.anWeeksTitle")}</h2>
        <Card className="flex flex-col gap-3">
          {weeks.map((w) => {
            const floorRate = w.daysCounted ? w.floorDays / w.daysCounted : 0;
            const keyRate = w.daysCounted ? w.keystoneDays / w.daysCounted : 0;
            const isCurrent = w === weeks[0];
            return (
              <div key={`${w.jaar}-${w.week}`} className="flex items-center gap-3">
                <div className="w-16 shrink-0">
                  <p className={clsx("text-sm", isCurrent ? "text-ink font-medium" : "text-ink")}>
                    {t("habits.anWeekLabel", { week: w.week })}
                  </p>
                  <p className="text-[10px] text-muted">{shortDate(w.startIso)}</p>
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted w-16 shrink-0">{t("habits.anFloorCol")}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-gold rounded-full" style={{ width: pct(floorRate) }} />
                    </div>
                    <span className="font-mono text-[11px] text-muted w-8 text-right shrink-0">{w.floorDays}/{w.daysCounted}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-muted w-16 shrink-0">{t("habits.anKeystoneCol")}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full bg-win rounded-full" style={{ width: pct(keyRate) }} />
                    </div>
                    <span className="font-mono text-[11px] text-muted w-8 text-right shrink-0">{w.keystoneDays}/{w.daysCounted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
        <p className="text-xs text-muted">{t("habits.anWeekHint")}</p>
      </section>
    </div>
  );
}
