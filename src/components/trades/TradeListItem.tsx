import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Trade } from "@/lib/types";
import type { TradeEvaluation } from "@/lib/constants";
import { isMissed, rMultiple } from "@/lib/stats";
import { dateLocale, formatResult, resultDisplayValue } from "@/lib/format";
import { OutcomePill } from "@/components/ui/OutcomePill";
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
}

export function TradeListItem({ trade, onEdit, onDelete }: TradeListItemProps) {
  const { t, i18n } = useTranslation();
  const { hideFase } = useAuth();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const resultCtx = {
    rMultiple: rMultiple(trade),
    amount: saldo != null ? (trade.resultaat_pct / 100) * saldo : undefined,
  };
  const shownResult = resultDisplayValue(trade.resultaat_pct, resultUnit, resultCtx);
  const readOnly = !onEdit && !onDelete;
  const missed = isMissed(trade);
  const evalBadge = trade.trade_evaluation ? EVAL_BADGES[trade.trade_evaluation] : undefined;
  return (
    <div
      className={`grid ${hideFase ? "grid-cols-7" : "grid-cols-8"} gap-3 font-mono text-xs py-2 items-center border-b border-border-soft group`}
    >
      <span className="text-muted">
        {new Date(trade.datum_open + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </span>
      <span className="text-ink">{trade.instrument ?? trade.pair}</span>
      {!hideFase && (
        <span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-soft text-muted">{trade.fase}</span>
        </span>
      )}
      <span className="text-muted font-body truncate">{trade.trade_concept ?? "—"}</span>
      <span className="text-muted font-body truncate">{trade.entry ?? "—"}</span>
      <span className="flex items-center gap-1.5">
        <OutcomePill outcome={trade.outcome} />
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
      >
        {formatResult(trade.resultaat_pct, resultUnit, resultCtx)}
      </span>
      {!readOnly && (
        <span className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={() => onEdit(trade)} className="p-1 rounded hover:bg-ink/5 text-muted hover:text-ink">
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
