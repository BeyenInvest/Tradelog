import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade } from "@/lib/types";
import { WEEKDAYS, type Outcome } from "@/lib/constants";
import { dateLocale, formatAggregate, resultInUnit } from "@/lib/format";
import { round2, type ClosedTrade } from "@/lib/stats";
import {
  dayTotalsInUnit,
  groupDayChips,
  monthTotalOf,
  monthWeeks,
  rawDayTotalsInUnit,
  rowWeekNumber,
  tradesByDayOfMonth,
  tradingWeekRowTotals,
  visibleDayChips,
  type DayChip,
} from "@/lib/calendarTotals";
import { useResultDisplay } from "@/hooks/useResultDisplay";

/** Same outcome→color mapping OutcomePill uses elsewhere, applied here to a small leading dot rather than the whole pill — a calmer look than a fully colored chip. */
const OUTCOME_COLOR_VAR: Record<Outcome, string> = { Win: "win", Loss: "loss", BE: "be" };

/** Dot color for a chip: outcome color, or neutral grey for hypothetical (missed) and still-running (outcome null) trades. */
function chipColor(chip: DayChip, missed: boolean, alpha: number): string {
  return missed || chip.outcome == null ? "rgb(var(--color-muted) / 0.75)" : `rgb(var(--color-${OUTCOME_COLOR_VAR[chip.outcome]}) / ${alpha})`;
}

/** Tooltip label: "GBPCHF ×2" when several trades are folded into one chip. */
function chipLabel(chip: DayChip): string {
  return chip.count > 1 ? `${chip.pair} ×${chip.count}` : chip.pair;
}

/** A leading week column (number + total) + 7 day columns, shared by the weekday header and every week row so each week's label + running total sit at the front of its row. */
const GRID_TEMPLATE = { gridTemplateColumns: "minmax(3rem, auto) repeat(7, minmax(0, 1fr))" };

/** Narrowest (square) day cell that fits a counted pair-chip ("XAUUSD ×3" ≈ 61px + 12px padding) — below it (phones, narrow windows) the cell always shows dots. */
const NAMES_MIN_CELL_PX = 74;

/** Day-cell display: pair-chips with names, or one colored dot per trade (calmer). A per-device preference, so localStorage — no profile column (feature-freeze: no migration). */
type ChipMode = "pairs" | "dots";
const CHIP_MODE_KEY = "calendarChipMode";

function getInitialChipMode(): ChipMode {
  try {
    return localStorage.getItem(CHIP_MODE_KEY) === "dots" ? "dots" : "pairs";
  } catch {
    return "pairs"; // storage blocked
  }
}

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

  const [chipMode, setChipModeState] = useState<ChipMode>(getInitialChipMode);
  function setChipMode(mode: ChipMode) {
    setChipModeState(mode);
    try {
      localStorage.setItem(CHIP_MODE_KEY, mode);
    } catch {
      /* storage blocked/full — remembering the choice is best-effort */
    }
  }

  // The grid is fluid, so how many chips fit (and whether names fit at all)
  // follows the measured cell size — never a clipped half chip or a taller row.
  // Measured on the first weekday header: same column width as a (square) day
  // cell, and — unlike the cells — never remounts on a month switch. Observing
  // the column itself also catches the week column changing width (font load).
  const columnRef = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(80);
  useEffect(() => {
    const column = columnRef.current;
    if (!column || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setCellPx(Math.floor(column.getBoundingClientRect().width)));
    ro.observe(column);
    return () => ro.disconnect();
  }, []);
  const namesFit = cellPx >= NAMES_MIN_CELL_PX;
  const showNames = chipMode === "pairs" && namesFit;
  // Dots sit inline with the day number; past this many a "+N" takes over.
  const maxDots = namesFit ? 6 : 4;

  // Bucketing + dag-/maandtotalen: pure functies in src/lib/calendarTotals.ts
  // (audit T1 — de totaallogica is daar getest, hier alleen nog wiring).
  const byDay = useMemo(() => tradesByDayOfMonth(trades, year, month), [trades, year, month]);
  // Twee lagen (D1): raw voor week-/maandsommen (geen dubbele afronding — de
  // kalender matcht zo exact de KPI-rij), gerond voor de dagcellen zelf.
  const rawResultByDay = useMemo(() => rawDayTotalsInUnit(byDay, resultUnit, saldo), [byDay, resultUnit, saldo]);
  const realResultByDay = useMemo(() => dayTotalsInUnit(byDay, resultUnit, saldo), [byDay, resultUnit, saldo]);
  const monthTotal = useMemo(() => monthTotalOf(rawResultByDay), [rawResultByDay]);

  // Missed/open trades bucketed the same string-based way as the closed ones;
  // the per-day chips are folded at render time via groupDayChips (calendarTotals.ts).
  const missedByDay = useMemo(() => tradesByDayOfMonth(missedTrades, year, month), [missedTrades, year, month]);
  const openByDay = useMemo(() => tradesByDayOfMonth(openTrades, year, month), [openTrades, year, month]);

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
    for (const [day, dayMissed] of missedByDay) {
      // Dag-totaal in de gekozen eenheid (Fase J) — resultInUnit is de gedeelde
      // conversie (zelfde regels als tradesInResultUnit).
      m.set(day, dayMissed.reduce((s, t) => s + resultInUnit(t, resultUnit, saldo), 0));
    }
    return m;
  }, [missedByDay, resultUnit, saldo]);

  // Full weeks (each 7 cells, null = padding) so every row can carry a leading
  // week-total cell — construction lives in calendarTotals.ts.
  const weeks = useMemo(() => monthWeeks(year, month), [year, month]);
  // Handelsweek-regel: zondag ≥ 22:00 telt in de VOLGENDE rij (ook over de
  // maandgrens) — daarom over de volle trades-lijst, niet over byDay/rawResultByDay.
  const weekRowTotals = useMemo(
    () => tradingWeekRowTotals(trades, year, month, resultUnit, saldo),
    [trades, year, month, resultUnit, saldo]
  );

  const monthLabel = monthDate.toLocaleDateString(dateLocale(i18n.language), { month: "long", year: "numeric" });

  function renderDayCell(d: number | null, key: number) {
    if (!d) return <div key={key} />;
    const dayTrades = byDay.get(d);
    const dayResult = realResultByDay.get(d) ?? null;
    const missed = missedDayResult.get(d);
    const missedResult = missed != null ? round2(missed) : null;
    const dayOpen = openByDay.get(d);
    const hasOpen = dayOpen != null;

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
    // A day with a real result also lists its still-running trades (grey chips) —
    // only missed trades stay chip-less there (the dashed border flags them).
    const dayPairs = dayTrades
      ? groupDayChips([...dayTrades, ...(dayOpen ?? [])])
      : displayOpen && dayOpen
        ? groupDayChips(dayOpen)
        : displayMissed
          ? groupDayChips(missedByDay.get(d) ?? [])
          : undefined;
    const { visible: visiblePairs, hiddenTrades } = visibleDayChips(showNames ? (dayPairs ?? []) : [], cellPx);
    // Dots mode: one dot per trade (a folded "×2" chip becomes two dots).
    const dots = showNames ? [] : (dayPairs ?? []).flatMap((chip) => Array.from({ length: chip.count }, () => chip));
    const pairList = dayPairs?.map(chipLabel).join(", ");

    return (
      <button
        key={key}
        type="button"
        onClick={() => onDayClick?.(dateIso)}
        className={`relative rounded-lg p-1.5 aspect-square flex flex-col justify-between text-left ${showNames ? "overflow-hidden" : ""}`}
        style={{ background: bg, border: `1px ${borderStyle} ${border}` }}
        title={
          displayMissed
            ? t("calendar.missedHypothetical")
            : displayOpen
              ? `${t("tradeBadge.open")} — ${pairList}`
              : errorTypes
                ? `${Array.from(errorTypes).join(", ")} — ${pairList}`
                : pairList
        }
      >
        {errorTypes && <TriangleAlert size={11} strokeWidth={2.5} className="absolute top-1 right-1 text-gold" />}
        <span className="flex items-center gap-1">
          <span className="font-mono text-[11px] leading-none text-muted">{d}</span>
          {/* Dots mode (chosen, or forced in cells too narrow for readable names): a dot per trade inline with the day number. Full names are one hover/tap away (title, day modal). */}
          {dots.length > 0 && (
            <span className="flex items-center gap-0.5">
              {dots.slice(0, maxDots).map((chip, i) => (
                <span key={i} className="w-[4px] h-[4px] rounded-full border" style={{ borderColor: chipColor(chip, displayMissed, 0.9) }} />
              ))}
              {dots.length > maxDots && <span className="font-mono text-[8px] leading-none text-faint">+{dots.length - maxDots}</span>}
            </span>
          )}
        </span>
        {/* As many chips as the measured cell fits (3 at full size); the rest folds into "+N meer", N = hidden trades — see visibleDayChips. */}
        {(visiblePairs.length > 0 || hiddenTrades > 0) && (
          <div className="flex flex-col items-start gap-[2px] min-h-0 overflow-hidden">
            {visiblePairs.map((chip) => (
              <span
                key={`${chip.pair}-${chip.outcome}`}
                className={`inline-flex items-center gap-1 font-mono text-[8px] leading-none px-1 py-[2px] rounded-full border border-border-soft/70 bg-surface/60 text-muted whitespace-nowrap ${
                  displayMissed ? "italic" : ""
                }`}
              >
                <span className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: chipColor(chip, displayMissed, 1) }} />
                {chip.pair}
                {/* Same pair + same outcome more than once: one chip, the count keeps every trade visible. */}
                {chip.count > 1 && <span className="text-faint">×{chip.count}</span>}
              </span>
            ))}
            {hiddenTrades > 0 && (
              <span className="font-mono text-[8px] leading-none px-1 text-faint">{t("calendar.moreTrades", { count: hiddenTrades })}</span>
            )}
          </div>
        )}
        {displayValue != null && (
          <span
            className="font-mono text-[11px] leading-none font-medium self-end"
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
          {/* Paren | Bolletjes — only offered where names fit; phone-size cells always show dots. */}
          {namesFit && (
            <div role="group" aria-label={t("calendar.chipMode")} className="flex items-center rounded-md border border-border-soft p-0.5 mr-1">
              {(["pairs", "dots"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={chipMode === mode}
                  onClick={() => setChipMode(mode)}
                  className={`px-2 py-0.5 rounded font-body text-[11px] transition-colors ${
                    chipMode === mode ? "bg-ink/5 text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {t(mode === "pairs" ? "calendar.chipModePairs" : "calendar.chipModeDots")}
                </button>
              ))}
            </div>
          )}
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
        {WEEKDAYS.map((d, i) => (
          <div key={d} ref={i === 0 ? columnRef : undefined} className="text-center">
            {t(`weekdays.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid gap-1.5" style={GRID_TEMPLATE}>
        {weeks.map((week, wi) => {
          const { total: weekTotal, hasResult, hasShifted } = weekRowTotals[wi];
          const weekNum = rowWeekNumber(year, month, wi);
          return (
            <div key={wi} className="contents">
              <div
                className="flex flex-col items-center justify-center gap-0.5 leading-none"
                title={hasShifted ? t("calendar.weekTotalShifted") : t("calendar.weekTotal")}
              >
                <span className="font-mono text-[10px] text-faint">{t("calendar.weekNum", { n: weekNum })}</span>
                {hasResult && (
                  <span className="font-mono text-[11px]" style={{ color: totalColor(weekTotal) }}>
                    {formatAggregate(weekTotal, resultUnit, { decimals: resultUnit === "currency" ? 0 : 1 })}
                    {/* Subtiele hint (plan-punt 7): zonder marker lijkt de rij "zichtbaar" niet te kloppen. */}
                    {hasShifted && <span className="text-faint">*</span>}
                  </span>
                )}
                {!hasResult && hasShifted && <span className="font-mono text-[11px] text-faint">*</span>}
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
