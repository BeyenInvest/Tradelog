import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade } from "@/lib/types";
import { WEEKDAYS, type Outcome } from "@/lib/constants";
import { dateLocale, formatAggregate, resultInUnit } from "@/lib/format";
import { round2 } from "@/lib/stats";
import { useResultDisplay } from "@/hooks/useResultDisplay";

interface PairChip {
  pair: string;
  outcome: Outcome;
}

/** Same outcome→color mapping OutcomePill uses elsewhere, applied here to a small leading dot rather than the whole pill — a calmer look than a fully colored chip. */
const OUTCOME_COLOR_VAR: Record<Outcome, string> = { Win: "win", Loss: "loss", BE: "be" };

interface CalendarViewProps {
  trades: Trade[];
  /** Missed trades to render, e.g. only passed when the "toon missed trades" toggle is on. Never affects a day's real coloring/value — that's driven by `trades` alone; missed-only days get their own dashed gold styling. */
  missedTrades?: Trade[];
  /** Fires for any clicked day, even empty ones — the caller decides whether that means "show trades" or "add a trade here". */
  onDayClick?: (dateIso: string) => void;
}

export function CalendarView({ trades, missedTrades = [], onDayClick }: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  const { unit: resultUnit, saldo } = useResultDisplay();
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

  /** Unique (pair, outcome) combos per day, in first-taken order — a pair traded twice with the same outcome shows once, but a pair that won once and lost once still shows both, since the outcome drives the chip's color. */
  const pairsByDay = useMemo(() => {
    const m = new Map<number, PairChip[]>();
    for (const [day, dayTrades] of byDay) {
      const seen = new Set<string>();
      const chips: PairChip[] = [];
      for (const t of dayTrades) {
        // Chip label is the instrument (falls back to pair for legacy/forex) — so a
        // non-forex journal shows its tickers, not the hidden default pair (cyclus 7).
        const sym = t.instrument ?? t.pair;
        const key = `${sym}|${t.outcome}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chips.push({ pair: sym, outcome: t.outcome });
      }
      m.set(day, chips);
    }
    return m;
  }, [byDay]);

  const missedPairsByDay = useMemo(() => {
    const m = new Map<number, PairChip[]>();
    for (const t of missedTrades) {
      const d = new Date(t.datum_open + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const chips = m.get(day) ?? [];
        const sym = t.instrument ?? t.pair;
        const key = `${sym}|${t.outcome}`;
        if (!chips.some((c) => `${c.pair}|${c.outcome}` === key)) chips.push({ pair: sym, outcome: t.outcome });
        m.set(day, chips);
      }
    }
    return m;
  }, [missedTrades, year, month]);

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
        // Dag-totaal in de gekozen eenheid (Fase J) — resultInUnit is de gedeelde
        // conversie (zelfde regels als tradesInResultUnit).
        m.set(day, (m.get(day) ?? 0) + resultInUnit(t, resultUnit, saldo));
      }
    }
    return m;
  }, [missedTrades, year, month, resultUnit, saldo]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = monthDate.toLocaleDateString(dateLocale(i18n.language), { month: "long", year: "numeric" });

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
            {t(`weekdays.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dayTrades = byDay.get(d);
          // round2 op de rauwe som (CLAUDE.md-invariant): normaliseert -0/float-stof,
          // zodat de win/loss-celkleur en het getal nooit op -2.8e-17 kunnen afgaan.
          const dayResult = dayTrades ? round2(dayTrades.reduce((s, t) => s + resultInUnit(t, resultUnit, saldo), 0)) : null;
          const missed = missedDayResult.get(d);
          const missedResult = missed != null ? round2(missed) : null;

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
              // Real result stays the displayed value — the missed trade only flags via the dashed grey border. Deliberately neutral (muted), not the be/orange token — that now means an actual breakeven outcome, not "hypothetical".
              border = "rgb(var(--color-muted) / 0.6)";
              borderStyle = "dashed";
            }
          } else if (missedResult != null) {
            bg = "rgb(var(--color-muted) / 0.08)";
            border = "rgb(var(--color-muted) / 0.5)";
            borderStyle = "dashed";
            displayValue = missedResult;
            displayColor = "rgb(var(--color-muted))";
            displayMissed = true;
          }

          const dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const errorTypes = errorDayTypes.get(d);
          const dayPairs = dayTrades ? pairsByDay.get(d) : missedResult != null ? missedPairsByDay.get(d) : undefined;
          const visiblePairs = dayPairs?.slice(0, 2) ?? [];
          const extraPairCount = dayPairs ? dayPairs.length - visiblePairs.length : 0;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick?.(dateIso)}
              className="relative rounded-lg p-1.5 aspect-square flex flex-col justify-between text-left"
              style={{ background: bg, border: `1px ${borderStyle} ${border}` }}
              title={
                displayMissed
                  ? t("calendar.missedHypothetical")
                  : errorTypes
                    ? Array.from(errorTypes).join(", ")
                    : dayPairs?.map((c) => c.pair).join(", ")
              }
            >
              {errorTypes && <TriangleAlert size={11} strokeWidth={2.5} className="absolute top-1 right-1 text-gold" />}
              <span className="flex items-center gap-1">
                <span className="font-mono text-[11px] text-muted">{d}</span>
                {/* Narrow cells (mobile, <640px viewport): no room for readable pair text — a dot per pair inline with the day number instead. Full names are always one tap away via the day modal. */}
                {dayPairs && dayPairs.length > 0 && (
                  <span className="flex sm:hidden items-center gap-0.5">
                    {dayPairs.slice(0, 4).map((chip) => (
                      <span
                        key={`${chip.pair}-${chip.outcome}`}
                        className="w-[4px] h-[4px] rounded-full border"
                        style={{
                          borderColor: displayMissed
                            ? "rgb(var(--color-muted) / 0.8)"
                            : `rgb(var(--color-${OUTCOME_COLOR_VAR[chip.outcome]}) / 0.9)`,
                        }}
                      />
                    ))}
                  </span>
                )}
              </span>
              {visiblePairs.length > 0 && (
                <div className="hidden sm:flex sm:flex-col items-start gap-0.5 overflow-hidden">
                  {visiblePairs.map((chip) => (
                    <span
                      key={`${chip.pair}-${chip.outcome}`}
                      className={`inline-flex items-center gap-1 font-mono text-[8px] leading-none px-1 py-[3px] rounded-full border border-border-soft/70 bg-surface/60 text-muted whitespace-nowrap ${
                        displayMissed ? "italic" : ""
                      }`}
                    >
                      <span
                        className="w-[4px] h-[4px] rounded-full shrink-0"
                        style={{
                          background: displayMissed ? "rgb(var(--color-muted) / 0.7)" : `rgb(var(--color-${OUTCOME_COLOR_VAR[chip.outcome]}))`,
                        }}
                      />
                      {chip.pair}
                    </span>
                  ))}
                  {extraPairCount > 0 && (
                    <span className="font-mono text-[8px] leading-none px-1 py-[3px] rounded-full border border-border-soft/70 bg-surface/60 text-faint">
                      +{extraPairCount}
                    </span>
                  )}
                </div>
              )}
              {displayValue != null && (
                <span
                  className="font-mono text-[11px] font-medium self-end"
                  style={{ color: displayColor, fontStyle: displayMissed ? "italic" : "normal" }}
                >
                  {/* Krappe cel: 1 decimaal voor %/R, hele euro's voor geld. */}
                  {formatAggregate(displayValue, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 })}
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
