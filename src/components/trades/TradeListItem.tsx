import { Pencil, Trash2 } from "lucide-react";
import type { Trade } from "@/lib/types";
import type { TradeEvaluation } from "@/lib/constants";
import { OutcomePill } from "@/components/ui/OutcomePill";

const EVAL_BADGES: Partial<Record<TradeEvaluation, { label: string; title: string }>> = {
  "Missed trade": { label: "missed", title: "Hypothetisch — deze trade is niet genomen" },
  "Emotional error": { label: "emotional", title: "Zelfbeoordeling: emotionele fout" },
  "Technical error": { label: "technical", title: "Zelfbeoordeling: technische fout" },
};

interface TradeListItemProps {
  trade: Trade;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
}

export function TradeListItem({ trade, onEdit, onDelete }: TradeListItemProps) {
  const isMissed = trade.trade_evaluation === "Missed trade";
  const evalBadge = trade.trade_evaluation ? EVAL_BADGES[trade.trade_evaluation] : undefined;
  return (
    <div
      className={`grid grid-cols-7 gap-3 font-mono text-xs py-2 items-center border-b border-border-soft group ${isMissed ? "opacity-60" : ""}`}
    >
      <span className="text-muted">
        {new Date(trade.datum_open + "T00:00:00").toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </span>
      <span className="text-ink">{trade.pair}</span>
      <span className="text-muted">{trade.fase}</span>
      <span className="text-muted font-body truncate">{trade.trade_concept ?? "—"}</span>
      <span className="flex items-center gap-1.5">
        <OutcomePill outcome={trade.outcome} />
        {evalBadge && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-faint" title={evalBadge.title}>
            {evalBadge.label}
          </span>
        )}
      </span>
      <span
        className="text-right"
        style={{ color: trade.resultaat_pct > 0 ? "#5FAE82" : trade.resultaat_pct < 0 ? "#E0665A" : "#8B93A7" }}
      >
        {trade.resultaat_pct > 0 ? "+" : ""}
        {trade.resultaat_pct}%
      </span>
      <span className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(trade)} className="p-1 rounded hover:bg-white/5 text-muted hover:text-ink">
          <Pencil size={13} />
        </button>
        <button onClick={() => onDelete(trade)} className="p-1 rounded hover:bg-white/5 text-muted hover:text-loss">
          <Trash2 size={13} />
        </button>
      </span>
    </div>
  );
}
