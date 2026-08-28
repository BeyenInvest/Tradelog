import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewSectionsDisplay } from "@/components/reviews/ReviewSectionsDisplay";
import { ReviewTradeGroups, periodicExtraGroupModes } from "@/components/reviews/ReviewTradeGroups";
import { columnModeForTrades } from "@/components/trades/TradeListHeader";
import { takenTrades, missedTrades, closedTrades, computeErrorCounts } from "@/lib/stats";
import { periodLabel, rangeOfPeriod } from "@/lib/periodRanges";
import { dateLocale, tradesInResultUnit } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";
import { useReviewSectionsFor } from "@/hooks/useReviewSections";
import { resolveReviewSections } from "@/lib/reviewSections";
import type { PeriodicReview, Trade } from "@/lib/types";

/** Read-only equivalent of PeriodicReviewDetail — no edit/delete, for the admin debug view. */
export function ReadOnlyPeriodicReviewModal({
  review, trades, onClose,
}: {
  review: PeriodicReview;
  /** Live-journal trades for the user — filtered here to the review's period range, same as ReviewsPage's tradesInPeriod. */
  trades: Trade[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const sectionRows = useReviewSectionsFor(review.methodology_id);
  const sections = useMemo(() => resolveReviewSections("periodic", sectionRows, review.period_type), [sectionRows, review.period_type]);
  const inPeriod = useMemo(() => {
    const { start, end } = rangeOfPeriod(review.period_type, review.jaar, review.periode_nummer);
    return trades.filter((t) => t.datum_open >= start && t.datum_open <= end);
  }, [trades, review]);
  const taken = useMemo(() => takenTrades(inPeriod), [inPeriod]);
  const missed = useMemo(() => missedTrades(inPeriod), [inPeriod]);
  // In de eenheid van de kijkende admin (Fase J): counts veranderen niet, alleen missedResultaat.
  const resultUnit = useResultUnit();
  const errorCounts = useMemo(
    () => computeErrorCounts(taken, tradesInResultUnit(closedTrades(missed), resultUnit)),
    [taken, missed, resultUnit]
  );

  return (
    <Modal labelledBy="admin-periodic-review-title" maxWidthClass="max-w-2xl" scroll onClose={onClose}>
      {(requestClose) => (
        <>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 id="admin-periodic-review-title" className="font-display text-xl italic text-ink">
                {periodLabel(review.period_type, review.jaar, review.periode_nummer, dateLocale(i18n.language))}
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
              <ReviewSectionsDisplay kind="periodic" sections={sections} source={review} />
            </section>

            <section className="flex flex-col gap-4 border-t border-border pt-6">
              <p className="font-body text-xs uppercase tracking-wider text-gold">{t("reviews.tradesInPeriod", { count: taken.length + missed.length })}</p>
              <ReviewTradeGroups taken={taken} missed={missed} extraGroupModes={periodicExtraGroupModes(review.period_type)} columnMode={columnModeForTrades(inPeriod)} />
            </section>
          </div>
        </>
      )}
    </Modal>
  );
}
