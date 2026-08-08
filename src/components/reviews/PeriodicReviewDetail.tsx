import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PeriodicReview, Trade } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { periodLabel, rangeOfPeriod } from "@/lib/periodRanges";
import { computeErrorCounts } from "@/lib/stats";
import { buildReviewPdfData } from "@/lib/pdf/reviewPdfData";
import { TradeForm } from "@/components/trades/TradeForm";
import { PeriodicReviewContentDisplay } from "./PeriodicReviewContentDisplay";
import { ReviewStatsHeader } from "./ReviewStatsHeader";
import { ReviewErrorStats } from "./ReviewErrorStats";
import { ReviewTradeGroups, periodicExtraGroupModes } from "./ReviewTradeGroups";
import { DownloadReviewPdfButton } from "./DownloadReviewPdfButton";

interface PeriodicReviewDetailProps {
  review: PeriodicReview;
  taken: Trade[];
  missed: Trade[];
  onEdit: () => void;
  onDelete: () => void;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
}

/** Trades shown here are matched purely by datum_open falling inside the period's date range — there's no FK, so no relink action is needed (unlike weekly reviews). */
export function PeriodicReviewDetail({ review, taken, missed, onEdit, onDelete, onAddTrade }: PeriodicReviewDetailProps) {
  const { t } = useTranslation();
  const errorCounts = useMemo(() => computeErrorCounts(taken, missed), [taken, missed]);
  const [addOpen, setAddOpen] = useState(false);

  // No FK: a trade added inside the period's date range shows up automatically after the refresh.
  const periodeNummerForRange = review.period_type === "year" ? null : review.periode_nummer;
  const periodRange = rangeOfPeriod(review.period_type, review.jaar, periodeNummerForRange);
  const today = new Date().toISOString().slice(0, 10);
  const newTradeDate = today >= periodRange.start && today <= periodRange.end ? today : periodRange.start;

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl italic text-ink">{periodLabel(review.period_type, review.jaar, review.periode_nummer)}</h3>
          {review.titel && <p className="font-body text-sm text-muted mt-1">{review.titel}</p>}
        </div>
        <div className="flex items-center gap-1">
          <DownloadReviewPdfButton getData={() => buildReviewPdfData(t, { kind: "periodic", review, taken, missed })} />
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
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-xs uppercase tracking-wider text-gold">{t("reviews.tradesInPeriod", { count: taken.length + missed.length })}</p>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-ink"
            >
              <Plus size={13} /> {t("tradeForm.addTrade")}
            </button>
          </div>
          <ReviewTradeGroups taken={taken} missed={missed} extraGroupModes={periodicExtraGroupModes(review.period_type)} />
        </section>
      </div>

      {addOpen &&
        createPortal(
          <TradeForm onSubmit={onAddTrade} onClose={() => setAddOpen(false)} allowMissedTrade initialDate={newTradeDate} />,
          document.body
        )}
    </Card>
  );
}
