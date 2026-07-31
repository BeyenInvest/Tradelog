import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade } from "@/lib/types";
import { WEEKDAYS } from "@/lib/constants";

interface CalendarViewProps {
  trades: Trade[];
  /** Missed trades to render, e.g. only passed when the "toon missed trades" toggle is on. Never affects a day's real coloring/value — that's driven by `trades` alone; missed-only days get their own dashed gold styling. */
  missedTrades?: Trade[];
  onDayClick?: (dateIso: string, trades: Trade[]) => void;
}

export function CalendarView({ trades, missedTrades = [], onDayClick }: CalendarViewProps) {
  const [monthDate, setMonthDate] = useState(() => new Date());
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = useMemo(() => {
    const m = new Map<number, Trade[]>();
    for (const t of trades) {
      const d = new Date(t.datum_open + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const bucket = m.get(day) ?? [];
        bucket.push(t);
        m.set(day, bucket);
      }
    }
    return m;
  }, [trades, year, month]);

  const errorDayTypes = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const t of trades) {
      if (t.trade_evaluation !== "Emotional error" && t.trade_evaluation !== "Technical error") continue;
      const d = new Date(t.datum_open + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const set = m.get(day) ?? new Set<string>();
        set.add(t.trade_evaluation);
        m.set(day, set);
      }
    }
    return m;
  }, [trades, year, month]);

  const missedDayResult = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of missedTrades) {
      const d = new Date(t.datum_open + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        m.set(day, (m.get(day) ?? 0) + t.resultaat_pct);
      }
    }
    return m;
  }, [missedTrades, year, month]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = monthDate.toLocaleDateString("nl-BE", { month: "long", year: "numeric" });

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl italic text-ink capitalize">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonthDate(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-md hover:bg-ink/5 text-muted"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setMonthDate(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-md hover:bg-ink/5 text-muted"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full">
      <div className="grid grid-cols-7 gap-1.5 font-body text-[11px] uppercase tracking-wide mb-2 text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dayTrades = byDay.get(d);
          const dayResult = dayTrades ? dayTrades.reduce((s, t) => s + t.resultaat_pct, 0) : null;
          const missedResult = missedDayResult.get(d) ?? null;

          let bg = "rgb(var(--color-bg))";
          let border = "rgb(var(--color-border-soft))";
          let borderStyle: "solid" | "dashed" = "solid";
          let displayValue = dayResult;
          let displayColor = "rgb(var(--color-gold))";
          let displayMissed = false;

          if (dayResult != null) {
            if (dayResult > 0) {
              bg = "rgb(var(--color-win) / 0.12)";
              border = "rgb(var(--color-win) / 0.4)";
              displayColor = "rgb(var(--color-win))";
            } else if (dayResult < 0) {
              bg = "rgb(var(--color-loss) / 0.12)";
              border = "rgb(var(--color-loss) / 0.4)";
              displayColor = "rgb(var(--color-loss))";
            } else {
              bg = "rgb(var(--color-gold) / 0.12)";
              border = "rgb(var(--color-gold) / 0.4)";
              displayColor = "rgb(var(--color-gold))";
            }
            if (missedResult != null) {
              // Real result stays the displayed value — the missed trade only flags via the dashed grey border.
              border = "rgb(var(--color-be) / 0.6)";
              borderStyle = "dashed";
            }
          } else if (missedResult != null) {
            bg = "rgb(var(--color-be) / 0.08)";
            border = "rgb(var(--color-be) / 0.5)";
            borderStyle = "dashed";
            displayValue = missedResult;
            displayColor = "rgb(var(--color-be))";
            displayMissed = true;
          }

          const dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const errorTypes = errorDayTypes.get(d);

          return (
            <button
              key={i}
              type="button"
              onClick={() => dayTrades && onDayClick?.(dateIso, dayTrades)}
              className="relative rounded-lg p-1.5 aspect-square flex flex-col justify-between text-left"
              style={{ background: bg, border: `1px ${borderStyle} ${border}` }}
              title={displayMissed ? "Missed trade (hypothetisch)" : errorTypes ? Array.from(errorTypes).join(", ") : undefined}
            >
              {errorTypes && <TriangleAlert size={11} strokeWidth={2.5} className="absolute top-1 right-1 text-gold" />}
              <span className="font-mono text-[11px] text-muted">{d}</span>
              {displayValue != null && (
                <span
                  className="font-mono text-[11px] font-medium self-end"
                  style={{ color: displayColor, fontStyle: displayMissed ? "italic" : "normal" }}
                >
                  {displayValue > 0 ? "+" : ""}
                  {displayValue.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
