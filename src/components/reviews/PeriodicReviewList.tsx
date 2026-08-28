import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import type { PeriodicReview } from "@/lib/types";
import { type PeriodType } from "@/lib/constants";
import { periodLabel } from "@/lib/periodRanges";
import { dateLocale, formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";

interface PeriodicReviewListProps {
  periodType: PeriodType;
  reviews: PeriodicReview[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Al in de actieve resultaat-eenheid (ReviewsPage rekent via tradesInResultUnit) — hier alleen het achtervoegsel. */
  resultaatOf: (review: PeriodicReview) => number;
  tradeCountOf: (review: PeriodicReview) => number;
}

export function PeriodicReviewList({ periodType, reviews, selectedId, onSelect, resultaatOf, tradeCountOf }: PeriodicReviewListProps) {
  const { t, i18n } = useTranslation();
  const resultUnit = useResultUnit();
  return (
    <Card className="flex flex-col gap-2">
      <h3 className="font-display text-xl italic mb-2 px-1 text-ink">{t(`reviews.${periodType === "month" ? "monthly" : periodType === "quarter" ? "quarterly" : "yearly"}ReviewsHeading`)}</h3>
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
              {periodLabel(rv.period_type, rv.jaar, rv.periode_nummer, dateLocale(i18n.language))}
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
