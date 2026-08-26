import clsx from "clsx";
import { Pencil, Trash2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Trade } from "@/lib/types";
import type { TradeEvaluation } from "@/lib/constants";
import { hasExplicitRisk, isMissed, isOpen, rMultiple } from "@/lib/stats";
import { dateLocale, formatResult, pctToAmount, resultDisplayValue } from "@/lib/format";
import { OutcomePill } from "@/components/ui/OutcomePill";
import type { TradeColumnMode } from "./TradeListHeader";
import { useAuth } from "@/hooks/useAuth";
import { useResultDisplay } from "@/hooks/useResultDisplay";

const EVAL_BADGES: Partial<Record<TradeEvaluation, { label: string; titleKey: string }>> = {
  "Missed trade": { label: "missed", titleKey: "tradeBadge.missedTitle" },
  "Emotional error": { label: "emotional", titleKey: "tradeBadge.emotionalTitle" },
  "Technical error": { label: "technical", titleKey: "tradeBadge.technicalTitle" },
};

interface TradeListItemProps {
  trade: Trade;
  /** Omit both to render read-only (no action column) — used by review trade lists. */
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
  /** Anonymous share views pass the owner's hide_fase instead of the viewer's (who has no profile) — same pattern as BacktestingAnalysisView. */
  hideFaseOverride?: boolean;
  /** Which middle-column pair to render — see TradeColumnMode. Defaults to "legacy" (Concept/Entry). */
  columnMode?: TradeColumnMode;
}

export function TradeListItem({ trade, onEdit, onDelete, hideFaseOverride, columnMode = "legacy" }: TradeListItemProps) {
  const { t, i18n } = useTranslation();
  const { hideFase: ownHideFase } = useAuth();
  const hideFase = hideFaseOverride ?? ownHideFase;
  const { unit: resultUnit, saldo } = useResultDisplay();
  const readOnly = !onEdit && !onDelete;
  const missed = isMissed(trade);
  const open = isOpen(trade);
  const modern = columnMode === "modern";
  const evalBadge = trade.trade_evaluation ? EVAL_BADGES[trade.trade_evaluation] : undefined;

  const dateCell = (
    <span className="text-muted">
      {new Date(trade.datum_open + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "2-digit" })}
      {/* Real open time (0051) when logged — the wall-clock string as typed, no Date round-trip. */}
      {trade.tijd_open ? ` ${trade.tijd_open.slice(0, 5)}` : ""}
    </span>
  );
  // Last column is wider than the rest so the open-trade actions (pencil + "Sluiten")
  // fit fully to the right of RESULTAAT instead of spilling left over its value.
  const gridClass = `grid ${hideFase ? "grid-cols-[repeat(6,minmax(0,1fr))_1.7fr]" : "grid-cols-[repeat(7,minmax(0,1fr))_1.7fr]"} gap-3 font-mono text-xs py-2 items-center border-b border-border-soft group`;

  // The two middle cells: universal Richting/R for a modern journal, the legacy
  // WPM Concept/Entry otherwise. R is "—" for a still-running trade (no result).
  const directionCell = <span className="text-muted font-body truncate">{trade.direction ?? "—"}</span>;
  const conceptCell = <span className="text-muted font-body truncate">{trade.trade_concept ?? "—"}</span>;
  const entryCell = <span className="text-muted font-body truncate">{trade.entry ?? "—"}</span>;
  // Fictieve-R-markering (punt B, Fase-I-praktijktest): zonder ingevuld risico is
  // R een aanname (1%-default, R ≡ %) — getoond met "~" en een uitleg-tooltip.
  const rAssumed = !hasExplicitRisk(trade);
  const rTitle = rAssumed ? t("list.assumedRiskTitle") : undefined;
  const rCell = (value: string) => (
    <span className="text-right text-muted" title={rTitle}>
      {value}
    </span>
  );

  // A still-running trade has no realized result yet: it shows a "loopt" badge in
  // the outcome column and "—" in the result column. Its action column carries both
  // a pencil (edit any field) and a prominent "Sluiten" — both open the same form,
  // but the pencil makes it discoverable that an open trade is editable, not only
  // closable (tester feedback). It's counted in no stat (closedTrades() excludes
  // it), so nothing here formats a % or R.
  if (open) {
    return (
      <div className={gridClass}>
        {dateCell}
        <span className="text-ink">{trade.instrument ?? trade.pair}</span>
        {!hideFase && (
          <span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-soft text-muted">{trade.fase}</span>
          </span>
        )}
        {modern ? directionCell : conceptCell}
        {modern ? rCell("—") : entryCell}
        <span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs bg-gold/15 text-gold"
            title={t("tradeBadge.openTitle")}
          >
            <Clock size={12} /> {t("tradeBadge.open")}
          </span>
        </span>
        <span className="text-right text-faint">—</span>
        {!readOnly && (
          <span className="flex justify-end items-center gap-2">
            {onEdit && (
              <>
                <button
                  onClick={() => onEdit(trade)}
                  title={t("list.editTrade")}
                  aria-label={t("list.editTrade")}
                  className="p-1 rounded hover:bg-ink/5 text-muted hover:text-ink"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onEdit(trade)}
                  className="font-body text-[11px] px-2 py-0.5 rounded border border-gold/50 text-gold hover:bg-gold/10 transition-colors"
                >
                  {t("list.closeTrade")}
                </button>
              </>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(trade)}
                className="p-1 rounded hover:bg-ink/5 text-muted hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={13} />
              </button>
            )}
          </span>
        )}
      </div>
    );
  }

  // Closed trade — the DB guarantees outcome + resultaat_pct are set (trades_open_result_chk).
  const outcome = trade.outcome!;
  const resultaat_pct = trade.resultaat_pct!;
  const resultCtx = {
    rMultiple: rMultiple({ resultaat_pct, risk_pct: trade.risk_pct }),
    rAssumed,
    amount: pctToAmount(resultaat_pct, saldo),
  };
  const shownResult = resultDisplayValue(resultaat_pct, resultUnit, resultCtx);
  const rValue = `${rAssumed ? "~" : ""}${resultCtx.rMultiple > 0 ? "+" : ""}${resultCtx.rMultiple.toFixed(2)}R`;
  return (
    <div className={gridClass}>
      {dateCell}
      <span className="text-ink">{trade.instrument ?? trade.pair}</span>
      {!hideFase && (
        <span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-soft text-muted">{trade.fase}</span>
        </span>
      )}
      {modern ? directionCell : conceptCell}
      {modern ? rCell(rValue) : entryCell}
      <span className="flex items-center gap-1.5">
        <OutcomePill outcome={outcome} />
        {evalBadge && (
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
              missed ? "bg-loss text-white border-loss" : "border-border text-faint"
            }`}
            title={t(evalBadge.titleKey)}
          >
            {evalBadge.label}
          </span>
        )}
      </span>
      <span
        className={clsx(
          "text-right",
          shownResult > 0 ? "text-win" : shownResult < 0 ? "text-loss" : "text-be"
        )}
        title={resultUnit === "R" ? rTitle : undefined}
      >
        {formatResult(resultaat_pct, resultUnit, resultCtx)}
      </span>
      {!readOnly && (
        <span className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={() => onEdit(trade)} title={t("list.editTrade")} aria-label={t("list.editTrade")} className="p-1 rounded hover:bg-ink/5 text-muted hover:text-ink">
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(trade)} className="p-1 rounded hover:bg-ink/5 text-muted hover:text-loss">
              <Trash2 size={13} />
            </button>
          )}
        </span>
      )}
    </div>
  );
}
