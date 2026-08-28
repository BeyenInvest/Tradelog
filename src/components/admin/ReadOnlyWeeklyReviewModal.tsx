import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewSectionsDisplay } from "@/components/reviews/ReviewSectionsDisplay";
import { ReviewTradeGroups } from "@/components/reviews/ReviewTradeGroups";
import { columnModeForTrades } from "@/components/trades/TradeListHeader";
import { takenTrades, missedTrades, closedTrades, computeErrorCounts } from "@/lib/stats";
import { tradesInResultUnit } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";
import { useReviewSectionsFor } from "@/hooks/useReviewSections";
import { resolveReviewSections } from "@/lib/reviewSections";
import type { Trade, WeeklyReview } from "@/lib/types";

/** Read-only equivalent of ReviewDetail — no edit/delete/relink, for the admin debug view. */
export function ReadOnlyWeeklyReviewModal({
  review, trades, onClose,
}: {
  review: WeeklyReview;
  trades: Trade[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sectionRows = useReviewSectionsFor(review.methodology_id);
  const sections = useMemo(() => resolveReviewSections("weekly", sectionRows), [sectionRows]);
  const linked = useMemo(() => trades.filter((t) => t.weekly_review_id === review.id), [trades, review.id]);
  const taken = useMemo(() => takenTrades(linked), [linked]);
  const missed = useMemo(() => missedTrades(linked), [linked]);
  // In de eenheid van de kijkende admin (Fase J): counts veranderen niet, alleen missedResultaat.
  const resultUnit = useResultUnit();
  const errorCounts = useMemo(
    () => computeErrorCounts(taken, tradesInResultUnit(closedTrades(missed), resultUnit)),
    [taken, missed, resultUnit]
  );

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
            <ReviewStatsHeader taken={closedTrades(taken)} missed={closedTrades(missed)} />
            <ReviewErrorStats {...errorCounts} />

            <section className="flex flex-col gap-4 border-t border-border pt-6">
              <ReviewSectionsDisplay kind="weekly" sections={sections} source={review} />
            </section>

            <section className="border-t border-border pt-6">
              <p className="font-body text-xs uppercase tracking-wider text-gold mb-4">{t("reviews.linkedTrades", { count: linked.length })}</p>
              <ReviewTradeGroups taken={taken} missed={missed} columnMode={columnModeForTrades(linked)} />
            </section>
          </div>
        </>
      )}
    </Modal>
  );
}
