import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Trade, WeeklyReview } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";
import { takenTrades, missedTrades } from "@/lib/stats";
import { ReviewTradeGroups } from "./ReviewTradeGroups";

interface LinkedTradesPanelProps {
  review: WeeklyReview;
  trades: Trade[];
  onRelink: (reviewId: string, jaar: number, weekNummer: number) => Promise<number>;
}

/** Trades linked to this review, split into "Trades genomen" and "Missed trades" by trade_evaluation. */
export function LinkedTradesPanel({ review, trades, onRelink }: LinkedTradesPanelProps) {
  const linked = trades.filter((t) => t.weekly_review_id === review.id);
  const taken = takenTrades(linked);
  const missed = missedTrades(linked);
  const [relinking, setRelinking] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRelink() {
    setRelinking(true);
    setError(null);
    try {
      const count = await onRelink(review.id, review.jaar, review.week_nummer);
      setLastCount(count);
    } catch (err) {
      setError(toErrorMessage(err, "Herkoppelen is mislukt"));
    } finally {
      setRelinking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-wider text-muted">Gekoppelde trades ({linked.length})</p>
        <button
          onClick={() => void handleRelink()}
          disabled={relinking}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
          title="Trades van deze ISO-week opnieuw koppelen"
        >
          <RefreshCw size={12} className={relinking ? "animate-spin" : ""} /> Herkoppelen
        </button>
      </div>
      {lastCount != null && !error && <p className="text-[11px] text-muted">{lastCount} trade(s) gekoppeld.</p>}
      {error && <p className="text-[11px] text-loss">{error}</p>}

      <ReviewTradeGroups taken={taken} missed={missed} />
    </div>
  );
}
