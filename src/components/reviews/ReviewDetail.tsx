import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade, WeeklyReview } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import { tradesInResultUnit } from "@/lib/format";
import { buildReviewPdfData } from "@/lib/pdf/reviewPdfData";
import { LinkedTradesPanel } from "./LinkedTradesPanel";
import { ReviewContentDisplay } from "./ReviewContentDisplay";
import { ReviewStatsHeader } from "./ReviewStatsHeader";
import { ReviewErrorStats } from "./ReviewErrorStats";
import { DownloadReviewPdfButton } from "./DownloadReviewPdfButton";

interface ReviewDetailProps {
  review: WeeklyReview;
  trades: Trade[];
  onEdit: () => void;
  onDelete: () => void;
  onRelink: (reviewId: string, jaar: number, weekNummer: number) => Promise<number>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
}

export function ReviewDetail({ review, trades, onEdit, onDelete, onRelink, onAddTrade }: ReviewDetailProps) {
  const { t } = useTranslation();
  const { profile, betaFeatures } = useAuth();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const linked = useMemo(() => trades.filter((t) => t.weekly_review_id === review.id), [trades, review.id]);
  const taken = useMemo(() => takenTrades(linked), [linked]);
  const missed = useMemo(() => missedTrades(linked), [linked]);
  // In de eenheid van de kijker (Fase J): counts veranderen niet, alleen missedResultaat.
  const errorCounts = useMemo(
    () => computeErrorCounts(tradesInResultUnit(taken, resultUnit, saldo), tradesInResultUnit(missed, resultUnit, saldo)),
    [taken, missed, resultUnit, saldo]
  );

  return (
    <Card className="lg:col-span-2 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display text-2xl italic text-ink">
            W{review.week_nummer} · {review.jaar}
          </h3>
          {review.titel && <p className="font-body text-sm text-muted mt-1">{review.titel}</p>}
        </div>
        <div className="flex items-center gap-1">
          <DownloadReviewPdfButton
            getData={() => buildReviewPdfData(t, { kind: "weekly", review, taken, missed, traderName: profile?.display_name, betaFeatures, resultUnit, saldo })}
          />
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
          <ReviewContentDisplay
            verhalen={review.verhalen}
            technisch={review.technisch}
            mentaal_owner={review.mentaal_owner}
            mentaal_trader={review.mentaal_trader}
            acties={review.acties}
            takeaway={review.takeaway}
            overall_comment={review.overall_comment}
          />
        </section>

        <section className="border-t border-border pt-6">
          <LinkedTradesPanel review={review} trades={trades} onRelink={onRelink} onAddTrade={onAddTrade} />
        </section>
      </div>
    </Card>
  );
}
