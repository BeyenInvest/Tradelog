import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Trade, WeeklyReview } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useAuth } from "@/hooks/useAuth";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { takenTrades, missedTrades, closedTrades, computeErrorCounts } from "@/lib/stats";
import { tradesInResultUnit } from "@/lib/format";
import { buildReviewPdfData } from "@/lib/pdf/reviewPdfData";
import { ShareReviewButton } from "@/components/share/ShareReviewButton";
import type { ReviewSection } from "@/lib/reviewSections";
import { LinkedTradesPanel } from "./LinkedTradesPanel";
import { ReviewSectionsDisplay } from "./ReviewSectionsDisplay";
import { ReviewStatsHeader } from "./ReviewStatsHeader";
import { ReviewErrorStats } from "./ReviewErrorStats";
import { DownloadReviewPdfButton } from "./DownloadReviewPdfButton";

interface ReviewDetailProps {
  review: WeeklyReview;
  /** This journal's resolved weekly review sections (Fase N5). */
  sections: ReviewSection[];
  trades: Trade[];
  onEdit: () => void;
  onDelete: () => void;
  onRelink: (reviewId: string, jaar: number, weekNummer: number) => Promise<number>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
}

export function ReviewDetail({ review, sections, trades, onEdit, onDelete, onRelink, onAddTrade }: ReviewDetailProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { unit: resultUnit, saldo } = useResultDisplay();
  const linked = useMemo(() => trades.filter((t) => t.weekly_review_id === review.id), [trades, review.id]);
  const taken = useMemo(() => takenTrades(linked), [linked]);
  const missed = useMemo(() => missedTrades(linked), [linked]);
  // Realized-stats input: exclude still-running open trades (missed rows are closed,
  // so closedTrades keeps them). `taken` (incl. open) still drives the display panels.
  const takenClosed = useMemo(() => closedTrades(taken), [taken]);
  const missedClosed = useMemo(() => closedTrades(missed), [missed]);
  // In de eenheid van de kijker (Fase J): counts veranderen niet, alleen missedResultaat.
  const errorCounts = useMemo(
    () => computeErrorCounts(taken, tradesInResultUnit(missedClosed, resultUnit, saldo)),
    [taken, missedClosed, resultUnit, saldo]
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
          <ShareReviewButton reviewRef={{ kind: "weekly", id: review.id }} />
          <DownloadReviewPdfButton
            getData={() => buildReviewPdfData(t, { kind: "weekly", review, sections, taken, missed: missedClosed, traderName: profile?.display_name, resultUnit, saldo })}
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
        <ReviewStatsHeader taken={takenClosed} missed={missedClosed} />
        <ReviewErrorStats {...errorCounts} />

        <section className="flex flex-col gap-4 border-t border-border pt-6">
          <ReviewSectionsDisplay kind="weekly" sections={sections} source={review} />
        </section>

        <section className="border-t border-border pt-6">
          <LinkedTradesPanel review={review} trades={trades} onRelink={onRelink} onAddTrade={onAddTrade} />
        </section>
      </div>
    </Card>
  );
}
