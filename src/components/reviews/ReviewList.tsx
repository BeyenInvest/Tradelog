import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";
import type { WeeklyReview } from "@/lib/types";

interface ReviewListProps {
  reviews: WeeklyReview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Al in de actieve resultaat-eenheid (ReviewsPage rekent via tradesInResultUnit) — hier alleen het achtervoegsel. */
  resultaatOf: (review: WeeklyReview) => number;
  tradeCountOf: (review: WeeklyReview) => number;
}

export function ReviewList({ reviews, selectedId, onSelect, resultaatOf, tradeCountOf }: ReviewListProps) {
  const { t } = useTranslation();
  const resultUnit = useResultUnit();
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-display text-xl italic mb-2 px-1 text-ink">{t("reviews.weeklyReviewsHeading")}</h3>
      {reviews.length === 0 && <p className="text-sm text-muted px-1">{t("reviews.noReviews")}</p>}
      {reviews.map((rv) => {
        const resultaat = resultaatOf(rv);
        const active = rv.id === selectedId;
        return (
          <button
            key={rv.id}
            onClick={() => onSelect(rv.id)}
            className={clsx(
              "text-left rounded-lg p-3 font-body text-sm transition-colors border",
              active ? "bg-surface-2 border-gold" : "bg-transparent border-transparent"
            )}
          >
            <p className="text-ink">
              W{rv.week_nummer} · {rv.jaar}
              {rv.titel ? ` — ${rv.titel}` : ""}
            </p>
            <p className={clsx("font-mono text-xs mt-1", resultaat >= 0 ? "text-win" : "text-loss")}>
              {formatAggregate(resultaat, resultUnit)} · {t("journal.tradesCount", { count: tradeCountOf(rv) })}
            </p>
          </button>
        );
      })}
    </Card>
  );
}
