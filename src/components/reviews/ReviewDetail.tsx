import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade, WeeklyReview } from "@/lib/types";
import { computeEquityCurve, computeDisciplineImpact, takenTrades } from "@/lib/stats";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { DisciplineImpactCards } from "@/components/trades/DisciplineImpactCards";
import { MarketCaptureLine } from "@/components/trades/MarketCaptureLine";
import { LinkedTradesPanel } from "./LinkedTradesPanel";
import { ReviewContentDisplay } from "./ReviewContentDisplay";

interface ReviewDetailProps {
  review: WeeklyReview;
  trades: Trade[];
  winRate: number;
  onEdit: () => void;
  onDelete: () => void;
  onRelink: (reviewId: string, jaar: number, weekNummer: number) => Promise<number>;
}

export function ReviewDetail({ review, trades, winRate, onEdit, onDelete, onRelink }: ReviewDetailProps) {
  const linked = useMemo(() => trades.filter((t) => t.weekly_review_id === review.id), [trades, review.id]);
  const taken = useMemo(() => takenTrades(linked), [linked]);
  const equityData = useMemo(() => computeEquityCurve(taken), [taken]);
  const disciplineImpact = useMemo(() => computeDisciplineImpact(linked), [linked]);

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl italic text-ink">
            W{review.week_nummer} · {review.jaar}
          </h3>
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

        {linked.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <DisciplineImpactCards impact={disciplineImpact} showMissed compact />
            </div>
            <MarketCaptureLine impact={disciplineImpact} />
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
        <LinkedTradesPanel review={review} trades={trades} onRelink={onRelink} />
      </div>
    </Card>
  );
}
