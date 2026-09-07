import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { CalendarDays, ListChecks, BarChart3, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { useHabits } from "@/hooks/useHabits";
import { TodayView } from "@/components/habits/TodayView";
import { CalendarView } from "@/components/habits/CalendarView";
import { AnalyseView } from "@/components/habits/AnalyseView";
import { BuilderView } from "@/components/habits/BuilderView";

type Tab = "today" | "calendar" | "analyse" | "beheer";

/**
 * Habit tracker (betaFeatures-gated). Since 0056 the habit list is user-built:
 *  - Today    — the daily quick check-in (instant-save ticks, floor, weekly targets).
 *  - Calendar — the agenda: month grid + a per-day editor to backfill any day.
 *  - Analysis — month totals + the per-week zig-zag.
 *  - Manage   — build/edit/reorder your own habits (never in Settings — here on the page).
 * All read the one useHabits hook, so a tick or an edit anywhere reflects everywhere.
 */
export default function HabitsPage() {
  const { t } = useTranslation();
  const habits = useHabits();
  const [tab, setTab] = useState<Tab>("today");

  // First time we learn the user has no habits yet, drop them on the builder.
  const routedOnce = useRef(false);
  useEffect(() => {
    if (habits.loading || routedOnce.current) return;
    routedOnce.current = true;
    if (!habits.hasHabits) setTab("beheer");
  }, [habits.loading, habits.hasHabits]);

  const tabs: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: "today", label: t("habits.tabToday"), icon: ListChecks },
    { id: "calendar", label: t("habits.tabCalendar"), icon: CalendarDays },
    { id: "analyse", label: t("habits.tabAnalyse"), icon: BarChart3 },
    { id: "beheer", label: t("habits.tabManage"), icon: SlidersHorizontal },
  ];

  const showEmptyPrompt = !habits.loading && !habits.hasHabits && tab !== "beheer";

  return (
    <>
      <PageHeader title={t("habits.title")} subtitle={t("habits.subtitle")} />

      {habits.error && <p className="text-sm text-loss mb-4">{habits.error}</p>}

      <div className="inline-flex gap-1 p-1 mb-6 rounded-xl bg-surface-2 border border-border overflow-x-auto max-w-full">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors shrink-0",
              tab === id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {showEmptyPrompt ? (
        <Card className="flex flex-col items-center text-center gap-3 py-10">
          <h2 className="font-display text-2xl italic text-ink">{t("habits.builderEmptyTitle")}</h2>
          <p className="text-sm text-muted max-w-md">{t("habits.builderEmptyBody")}</p>
          <button
            type="button"
            onClick={() => setTab("beheer")}
            className="mt-1 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
          >
            {t("habits.builderEmptyCta")}
          </button>
        </Card>
      ) : (
        <>
          {tab === "today" && <TodayView h={habits} />}
          {tab === "calendar" && <CalendarView h={habits} />}
          {tab === "analyse" && <AnalyseView h={habits} />}
          {tab === "beheer" && <BuilderView h={habits} />}
        </>
      )}
    </>
  );
}
