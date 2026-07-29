import { Card } from "@/components/ui/Card";
import type { PeriodicReview } from "@/lib/types";
import { PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { periodLabel } from "@/lib/periodRanges";

interface PeriodicReviewListProps {
  periodType: PeriodType;
  reviews: PeriodicReview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  resultaatOf: (review: PeriodicReview) => number;
  tradeCountOf: (review: PeriodicReview) => number;
}

export function PeriodicReviewList({ periodType, reviews, selectedId, onSelect, resultaatOf, tradeCountOf }: PeriodicReviewListProps) {
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-display text-xl italic mb-2 px-1 text-ink">{PERIOD_TYPE_LABELS[periodType]} reviews</h3>
      {reviews.length === 0 && <p className="text-sm text-muted px-1">Nog geen reviews.</p>}
      {reviews.map((rv) => {
        const resultaat = resultaatOf(rv);
        const active = rv.id === selectedId;
        return (
          <button
            key={rv.id}
            onClick={() => onSelect(rv.id)}
            className="text-left rounded-lg p-3 font-body text-sm transition-colors"
            style={{ background: active ? "#22242B" : "transparent", border: `1px solid ${active ? "#D4A64A" : "transparent"}` }}
          >
            <p className="text-ink">
              {periodLabel(rv.period_type, rv.jaar, rv.periode_nummer)}
              {rv.titel ? ` — ${rv.titel}` : ""}
            </p>
            <p className="font-mono text-xs mt-1" style={{ color: resultaat >= 0 ? "#5FAE82" : "#E0665A" }}>
              {resultaat > 0 ? "+" : ""}
              {resultaat}% · {tradeCountOf(rv)} trades
            </p>
          </button>
        );
      })}
    </Card>
  );
}
