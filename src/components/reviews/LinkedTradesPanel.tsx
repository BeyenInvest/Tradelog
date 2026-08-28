import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw } from "lucide-react";
import type { Trade, WeeklyReview } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { isoWeekRange } from "@/lib/isoWeek";
import { localTodayIso } from "@/lib/localDate";
import { toErrorMessage } from "@/lib/errorMessage";
import { takenTrades, missedTrades } from "@/lib/stats";
import { useMethodology } from "@/hooks/useMethodology";
import { TradeForm } from "@/components/trades/TradeForm";
import { ReviewTradeGroups } from "./ReviewTradeGroups";

interface LinkedTradesPanelProps {
  review: WeeklyReview;
  trades: Trade[];
  onRelink: (reviewId: string, jaar: number, weekNummer: number) => Promise<number>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
}

/** Trades linked to this review, split into "Trades genomen" and "Missed trades" by trade_evaluation. */
export function LinkedTradesPanel({ review, trades, onRelink, onAddTrade }: LinkedTradesPanelProps) {
  const { t } = useTranslation();
  const { isLegacyMethodology } = useMethodology();
  const columnMode = isLegacyMethodology ? "legacy" : "modern";
  const linked = trades.filter((t) => t.weekly_review_id === review.id);
  const taken = takenTrades(linked);
  const missed = missedTrades(linked);
  const [relinking, setRelinking] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const weekRange = isoWeekRange(review.jaar, review.week_nummer);
  const today = localTodayIso();
  const newTradeDate = today >= weekRange.start && today <= weekRange.end ? today : weekRange.start;

  async function handleRelink() {
    setRelinking(true);
    setError(null);
    try {
      const count = await onRelink(review.id, review.jaar, review.week_nummer);
      setLastCount(count);
    } catch (err) {
      setError(toErrorMessage(err, t("reviews.relinkFailed")));
    } finally {
      setRelinking(false);
    }
  }

  // The linked-trades list filters strictly on weekly_review_id, so a freshly added trade won't
  // appear until it's linked. Relinking this review's ISO week picks it up (it's dated into the week).
  async function handleAddTrade(input: TradeSubmitInput) {
    await onAddTrade(input);
    await onRelink(review.id, review.jaar, review.week_nummer);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-wider text-gold">{t("reviews.linkedTrades", { count: linked.length })}</p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-ink"
          >
            <Plus size={13} /> {t("tradeForm.addTrade")}
          </button>
          <button
            onClick={() => void handleRelink()}
            disabled={relinking}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
            title={t("reviews.relinkTitle")}
          >
            <RefreshCw size={12} className={relinking ? "animate-spin" : ""} /> {t("reviews.relink")}
          </button>
        </div>
      </div>
      {lastCount != null && !error && <p className="text-[11px] text-muted">{t("reviews.tradesLinked", { count: lastCount })}</p>}
      {error && <p className="text-[11px] text-loss">{error}</p>}

      <ReviewTradeGroups taken={taken} missed={missed} columnMode={columnMode} />

      {addOpen &&
        createPortal(
          <TradeForm onSubmit={handleAddTrade} onClose={() => setAddOpen(false)} allowMissedTrade initialDate={newTradeDate} />,
          document.body
        )}
    </div>
  );
}
