import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import type { Trade } from "@/lib/types";
import type { TradeEvaluation } from "@/lib/constants";
import { isMissed } from "@/lib/stats";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { useAuth } from "@/hooks/useAuth";

const EVAL_BADGES: Partial<Record<TradeEvaluation, { label: string; title: string }>> = {
  "Missed trade": { label: "missed", title: "Hypothetisch — deze trade is niet genomen" },
  "Emotional error": { label: "emotional", title: "Zelfbeoordeling: emotionele fout" },
  "Technical error": { label: "technical", title: "Zelfbeoordeling: technische fout" },
};

interface TradeListItemProps {
  trade: Trade;
  /** Omit both to render read-only (no action column) — used by review trade lists. */
  onEdit?: (trade: Trade) => void;
  onDelete?: (trade: Trade) => void;
}

export function TradeListItem({ trade, onEdit, onDelete }: TradeListItemProps) {
  const { hideFase } = useAuth();
  const readOnly = !onEdit && !onDelete;
  const missed = isMissed(trade);
  const evalBadge = trade.trade_evaluation ? EVAL_BADGES[trade.trade_evaluation] : undefined;
  return (
    <div
      className={`grid ${hideFase ? "grid-cols-6" : "grid-cols-7"} gap-3 font-mono text-xs py-2 items-center border-b border-border-soft group ${missed ? "opacity-60" : ""}`}
    >
      <span className="text-muted">
        {new Date(trade.datum_open + "T00:00:00").toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </span>
      <span className="text-ink">{trade.pair}</span>
      {!hideFase && (
        <span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border-soft text-muted">{trade.fase}</span>
        </span>
      )}
      <span className="text-muted font-body truncate">{trade.trade_concept ?? "—"}</span>
      <span className="flex items-center gap-1.5">
        <OutcomePill outcome={trade.outcome} muted={missed} />
        {evalBadge && (
          <span
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border text-faint ${
              missed ? "border-gold/50 text-gold" : "border-border"
            }`}
            title={evalBadge.title}
          >
            {evalBadge.label}
          </span>
        )}
      </span>
      <span
        className={clsx(
          "text-right",
          missed
            ? "text-faint"
            : trade.resultaat_pct > 0
              ? "text-win"
              : trade.resultaat_pct < 0
                ? "text-loss"
                : "text-be"
        )}
      >
        {trade.resultaat_pct > 0 ? "+" : ""}
        {trade.resultaat_pct}%
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
