import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { CalendarDays, ListChecks, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useHabits } from "@/hooks/useHabits";
import { TodayView } from "@/components/habits/TodayView";
import { CalendarView } from "@/components/habits/CalendarView";
import { AnalyseView } from "@/components/habits/AnalyseView";

type Tab = "today" | "calendar" | "analyse";

/**
 * Owner-only habit tracker for the "90-Day Run" (betaFeatures-gated). Three tabs:
 *  - Today    — the daily quick check-in (instant-save ticks, floor, weekly targets).
 *  - Calendar — the agenda: month grid + a per-day editor to backfill any day.
 *  - Analysis — month totals + the per-week zig-zag view.
 * All three read the one useHabits hook, so a tick anywhere reflects everywhere.
 */
export default function HabitsPage() {
  const { t } = useTranslation();
  const habits = useHabits();
  const [tab, setTab] = useState<Tab>("today");

  const tabs: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: "today", label: t("habits.tabToday"), icon: ListChecks },
    { id: "calendar", label: t("habits.tabCalendar"), icon: CalendarDays },
    { id: "analyse", label: t("habits.tabAnalyse"), icon: BarChart3 },
  ];

  return (
    <>
      <PageHeader title={t("habits.title")} subtitle={t("habits.subtitle")} />

      {habits.error && <p className="text-sm text-loss mb-4">{habits.error}</p>}

      <div className="inline-flex gap-1 p-1 mb-6 rounded-xl bg-surface-2 border border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
              tab === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === "today" && <TodayView h={habits} />}
      {tab === "calendar" && <CalendarView h={habits} />}
      {tab === "analyse" && <AnalyseView h={habits} />}
    </>
  );
}
