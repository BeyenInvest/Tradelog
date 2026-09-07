import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HabitCheckbox } from "@/components/habits/HabitCheckbox";
import type { useHabits } from "@/hooks/useHabits";
import { isFloorMet } from "@/lib/habits";

/** yyyy-mm-dd for a calendar cell — local, no timezone drift. */
function cellIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Month grid + a per-day editor. The grid is the "agenda": at a glance you see
 * which days the floor stood (gold) vs slipped. Tapping a past/today cell opens
 * that day's habits so a missed tick can be backfilled — `toggle` already writes
 * any day, so the same instant-save applies. Future days are shown but locked.
 */
export function CalendarView({ h }: { h: ReturnType<typeof useHabits> }) {
  const { t, i18n } = useTranslation();
  const { today, daysByDate, toggle, loading, dailyHabits, weeklyHabits, floorKeys, hasFloor } = h;

  const now = useMemo(() => new Date(today + "T00:00:00"), [today]);
  const [view, setView] = useState<{ year: number; month: number }>({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState<string>(today);

  const atCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const editHabits = useMemo(() => [...dailyHabits, ...weeklyHabits], [dailyHabits, weeklyHabits]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(new Date(view.year, view.month, 1)),
    [i18n.language, view]
  );

  // Monday-first weekday headers, localized (2024-01-01 is a Monday).
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
          <h2 className="font-display text-xl italic text-ink capitalize">{monthLabel}</h2>
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

      {/* Per-day editor */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl italic text-ink capitalize">{selectedLabel}</h2>
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
        ) : editHabits.length === 0 ? (
          <p className="text-sm text-muted">{t("habits.noDailyHabits")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {editHabits.map((hb) => (
              <HabitCheckbox
                key={hb.key}
                label={hb.label}
                checked={selectedValues[hb.key] === true}
                accent={hb.is_floor}
                disabled={loading}
                onToggle={(next) => void toggle(selected, hb.key, next)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
