import { useMemo } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewContentDisplay } from "@/components/reviews/ReviewContentDisplay";
import { ReviewTradeGroups } from "@/components/reviews/ReviewTradeGroups";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import type { Trade, WeeklyReview } from "@/lib/types";

/** Read-only equivalent of ReviewDetail — no edit/delete/relink, for the admin debug view. */
export function ReadOnlyWeeklyReviewModal({
  review, trades, onClose,
}: {
  review: WeeklyReview;
  trades: Trade[];
  onClose: () => void;
}) {
  const linked = useMemo(() => trades.filter((t) => t.weekly_review_id === review.id), [trades, review.id]);
  const taken = useMemo(() => takenTrades(linked), [linked]);
  const missed = useMemo(() => missedTrades(linked), [linked]);
  const errorCounts = useMemo(() => computeErrorCounts(taken, missed), [taken, missed]);

  return (
    <Modal labelledBy="admin-weekly-review-title" maxWidthClass="max-w-2xl" scroll onClose={onClose}>
      {(requestClose) => (
        <>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 id="admin-weekly-review-title" className="font-display text-xl italic text-ink">
                W{review.week_nummer} · {review.jaar}
              </h2>
              {review.titel && <p className="font-body text-sm text-muted mt-1">{review.titel}</p>}
            </div>
            <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <ReviewStatsHeader taken={taken} missed={missed} />
            <ReviewErrorStats {...errorCounts} />

            <section className="flex flex-col gap-4 border-t border-border pt-6">
              <ReviewContentDisplay
                technisch={review.technisch}
                mentaal_owner={review.mentaal_owner}
                mentaal_trader={review.mentaal_trader}
                acties={review.acties}
                takeaway={review.takeaway}
                overall_comment={review.overall_comment}
              />
            </section>

            <section className="border-t border-border pt-6">
              <p className="font-body text-xs uppercase tracking-wider text-muted mb-4">Gekoppelde trades ({linked.length})</p>
              <ReviewTradeGroups taken={taken} missed={missed} />
            </section>
          </div>
        </>
      )}
    </Modal>
  );
}
