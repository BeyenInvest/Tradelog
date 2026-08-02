import { useMemo } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PeriodicReview, Trade } from "@/lib/types";
import { periodLabel } from "@/lib/periodRanges";
import { computeErrorCounts } from "@/lib/stats";
import { PeriodicReviewContentDisplay } from "./PeriodicReviewContentDisplay";
import { ReviewStatsHeader } from "./ReviewStatsHeader";
import { ReviewErrorStats } from "./ReviewErrorStats";
import { ReviewTradeGroups, periodicExtraGroupModes } from "./ReviewTradeGroups";

interface PeriodicReviewDetailProps {
  review: PeriodicReview;
  taken: Trade[];
  missed: Trade[];
  onEdit: () => void;
  onDelete: () => void;
}

/** Trades shown here are matched purely by datum_open falling inside the period's date range — there's no FK, so no relink action is needed (unlike weekly reviews). */
export function PeriodicReviewDetail({ review, taken, missed, onEdit, onDelete }: PeriodicReviewDetailProps) {
  const errorCounts = useMemo(() => computeErrorCounts(taken, missed), [taken, missed]);

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl italic text-ink">{periodLabel(review.period_type, review.jaar, review.periode_nummer)}</h3>
          {review.titel && <p className="font-body text-sm text-muted mt-1">{review.titel}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-ink">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-ink/5 text-muted hover:text-loss">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <ReviewStatsHeader taken={taken} missed={missed} />
        <ReviewErrorStats {...errorCounts} />

        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <PeriodicReviewContentDisplay
            periodType={review.period_type}
            technisch={review.technisch}
            mentaal_owner={review.mentaal_owner}
            mentaal_trader={review.mentaal_trader}
            acties={review.acties}
            takeaway={review.takeaway}
            overall_comment={review.overall_comment}
            periode_overzicht={review.periode_overzicht}
          />
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <p className="font-body text-xs uppercase tracking-wider text-gold">Trades in periode ({taken.length + missed.length})</p>
          <ReviewTradeGroups taken={taken} missed={missed} extraGroupModes={periodicExtraGroupModes(review.period_type)} />
        </section>
      </div>
    </Card>
  );
}
