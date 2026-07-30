import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PeriodicReview, Trade } from "@/lib/types";
import { periodLabel } from "@/lib/periodRanges";
import { computeEquityCurve } from "@/lib/stats";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { ReviewContentDisplay } from "./ReviewContentDisplay";
import { TradeRows } from "./TradeRows";

interface PeriodicReviewDetailProps {
  review: PeriodicReview;
  taken: Trade[];
  missed: Trade[];
  winRate: number;
  onEdit: () => void;
  onDelete: () => void;
}

/** Trades shown here are matched purely by datum_open falling inside the period's date range — there's no FK, so no relink action is needed (unlike weekly reviews). */
export function PeriodicReviewDetail({ review, taken, missed, winRate, onEdit, onDelete }: PeriodicReviewDetailProps) {
  const equityData = useMemo(() => computeEquityCurve(taken), [taken]);

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl italic text-ink">{periodLabel(review.period_type, review.jaar, review.periode_nummer)}</h3>
          {review.titel && <p className="font-body text-sm text-muted mt-1">{review.titel}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-gold">{(winRate * 100).toFixed(0)}% win</span>
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-ink">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-loss">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {taken.length > 0 && (
          <div>
            <p className="font-body text-xs uppercase tracking-wider mb-2 text-muted">Cumulatief resultaat</p>
            <EquityCurveChart data={equityData} />
          </div>
        )}

        <ReviewContentDisplay
          technisch={review.technisch}
          mentaal_owner={review.mentaal_owner}
          mentaal_trader={review.mentaal_trader}
          acties={review.acties}
          takeaway={review.takeaway}
          overall_comment={review.overall_comment}
        />

        <hr className="border-border" />
        <div className="flex flex-col gap-4">
          <p className="font-body text-xs uppercase tracking-wider text-muted">Trades in periode ({taken.length + missed.length})</p>
          <TradeRows label="Trades genomen" rows={taken} emptyLabel="Geen genomen trades." />
          <TradeRows label="Missed trades" rows={missed} emptyLabel="Geen missed trades deze periode." muted />
        </div>
      </div>
    </Card>
  );
}
