import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade } from "@/lib/types";
import { WEEKDAYS, type Outcome } from "@/lib/constants";
import { dateLocale, formatAggregate, resultInUnit } from "@/lib/format";
import { round2, type ClosedTrade } from "@/lib/stats";
import { dayTotalsInUnit, monthTotalOf, monthWeeks, rowWeekNumber, tradesByDayOfMonth, weekTotalOf } from "@/lib/calendarTotals";
import { useResultDisplay } from "@/hooks/useResultDisplay";

interface PairChip {
  pair: string;
  outcome: Outcome;
}

/** Same outcome→color mapping OutcomePill uses elsewhere, applied here to a small leading dot rather than the whole pill — a calmer look than a fully colored chip. */
const OUTCOME_COLOR_VAR: Record<Outcome, string> = { Win: "win", Loss: "loss", BE: "be" };

/** A leading week column (number + total) + 7 day columns, shared by the weekday header and every week row so each week's label + running total sit at the front of its row. */
const GRID_TEMPLATE = { gridTemplateColumns: "minmax(3rem, auto) repeat(7, minmax(0, 1fr))" };

/** Sign → text color token for a compact aggregate (day/week/month totals). */
function totalColor(v: number): string {
  return v > 0 ? "rgb(var(--color-win))" : v < 0 ? "rgb(var(--color-loss))" : "rgb(var(--color-muted))";
}

interface CalendarViewProps {
  /** Realized (closed) trades only — the calendar colors days by real result; still-running open trades carry none and are excluded by the caller (closedTrades). */
  trades: ClosedTrade[];
  /** Missed trades to render, e.g. only passed when the "toon missed trades" toggle is on. Never affects a day's real coloring/value — that's driven by `trades` alone; missed-only days get their own dashed gold styling. */
  missedTrades?: ClosedTrade[];
  /** Still-running open trades — shown as a neutral light-grey marker (no result value yet), never colored win/loss/BE. A day with a real result keeps that result's coloring; open trades only style days that have no closed result of their own. */
  openTrades?: Trade[];
  /** Fires for any clicked day, even empty ones — the caller decides whether that means "show trades" or "add a trade here". */
  onDayClick?: (dateIso: string) => void;
}

export function CalendarView({ trades, missedTrades = [], openTrades = [], onDayClick }: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  // Bucketing + dag-/maandtotalen: pure functies in src/lib/calendarTotals.ts
  // (audit T1 — de totaallogica is daar getest, hier alleen nog wiring).
  const byDay = useMemo(() => tradesByDayOfMonth(trades, year, month), [trades, year, month]);
  const realResultByDay = useMemo(() => dayTotalsInUnit(byDay, resultUnit, saldo), [byDay, resultUnit, saldo]);
  const monthTotal = useMemo(() => monthTotalOf(realResultByDay), [realResultByDay]);

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

  // Still-running trades per day — neutral chips (no outcome color, no value). The
  // placeholder "BE" outcome is never read: open chips always render grey (displayOpen).
  const openPairsByDay = useMemo(() => {
    const m = new Map<number, PairChip[]>();
    for (const t of openTrades) {
      const d = new Date(t.datum_open + "T00:00:00");
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const chips = m.get(day) ?? [];
        const sym = t.instrument ?? t.pair;
        if (!chips.some((c) => c.pair === sym)) chips.push({ pair: sym, outcome: "BE" });
        m.set(day, chips);
      }
    }
    return m;
  }, [openTrades, year, month]);

  // Full weeks (each 7 cells, null = padding) so every row can carry a leading
  // week-total cell — construction lives in calendarTotals.ts.
  const weeks = useMemo(() => monthWeeks(year, month), [year, month]);

  const monthLabel = monthDate.toLocaleDateString(dateLocale(i18n.language), { month: "long", year: "numeric" });

  function renderDayCell(d: number | null, key: number) {
    if (!d) return <div key={key} />;
    const dayTrades = byDay.get(d);
    const dayResult = realResultByDay.get(d) ?? null;
    const missed = missedDayResult.get(d);
    const missedResult = missed != null ? round2(missed) : null;
    const openPairs = openPairsByDay.get(d);
    const hasOpen = openPairs != null;

    let bg = "rgb(var(--color-bg))";
    let border = "rgb(var(--color-border-soft))";
    let borderStyle: "solid" | "dashed" = "solid";
    let displayValue = dayResult;
    let displayColor = "rgb(var(--color-gold))";
    let displayMissed = false;
    let displayOpen = false;

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
    } else if (hasOpen) {
      // A day whose only activity is a still-running trade — no realized result
      // yet, so it reads neutral light-grey (solid, not the dashed grey of a
      // hypothetical missed trade) and shows no value.
      bg = "rgb(var(--color-muted) / 0.06)";
      border = "rgb(var(--color-muted) / 0.35)";
      borderStyle = "solid";
      displayOpen = true;
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
    const dayPairs = dayTrades ? pairsByDay.get(d) : displayOpen ? openPairs : missedResult != null ? missedPairsByDay.get(d) : undefined;
    const visiblePairs = dayPairs?.slice(0, 2) ?? [];
    const extraPairCount = dayPairs ? dayPairs.length - visiblePairs.length : 0;

    return (
      <button
        key={key}
        type="button"
        onClick={() => onDayClick?.(dateIso)}
        className="relative rounded-lg p-1.5 aspect-square flex flex-col justify-between text-left"
        style={{ background: bg, border: `1px ${borderStyle} ${border}` }}
        title={
          displayMissed
            ? t("calendar.missedHypothetical")
            : displayOpen
              ? `${t("tradeBadge.open")} — ${dayPairs?.map((c) => c.pair).join(", ")}`
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
                    borderColor: displayMissed || displayOpen
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
                    background: displayMissed || displayOpen ? "rgb(var(--color-muted) / 0.7)" : `rgb(var(--color-${OUTCOME_COLOR_VAR[chip.outcome]}))`,
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
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="font-display text-xl italic text-ink capitalize">{monthLabel}</h3>
          {/* Maandtotaal (Fase S1): realized net over the visible month in the chosen unit. */}
          <span className="font-mono text-sm" style={{ color: totalColor(monthTotal) }}>
            {formatAggregate(monthTotal, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 })}
          </span>
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
      <div className="grid gap-1.5 font-body text-[11px] uppercase tracking-wide mb-2 text-muted" style={GRID_TEMPLATE}>
        <div className="text-center text-faint">{t("calendar.weekColHeader")}</div>
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center">
            {t(`weekdays.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid gap-1.5" style={GRID_TEMPLATE}>
        {weeks.map((week, wi) => {
          const { total: weekTotal, hasResult } = weekTotalOf(week, realResultByDay);
          const weekNum = rowWeekNumber(year, month, wi);
          return (
            <div key={wi} className="contents">
              <div className="flex flex-col items-center justify-center gap-0.5 leading-none" title={t("calendar.weekTotal")}>
                <span className="font-mono text-[10px] text-faint">{t("calendar.weekNum", { n: weekNum })}</span>
                {hasResult && (
                  <span className="font-mono text-[11px]" style={{ color: totalColor(weekTotal) }}>
                    {formatAggregate(weekTotal, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 })}
                  </span>
                )}
              </div>
              {week.map((d, di) => renderDayCell(d, wi * 7 + di))}
            </div>
          );
        })}
      </div>
      </div>
    </Card>
  );
}
