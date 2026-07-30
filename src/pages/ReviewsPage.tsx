import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWeeklyReviews } from "@/hooks/useWeeklyReviews";
import { usePeriodicReviews } from "@/hooks/usePeriodicReviews";
import { useTrades } from "@/hooks/useTrades";
import { ReviewList } from "@/components/reviews/ReviewList";
import { ReviewDetail } from "@/components/reviews/ReviewDetail";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { PeriodicReviewList } from "@/components/reviews/PeriodicReviewList";
import { PeriodicReviewDetail } from "@/components/reviews/PeriodicReviewDetail";
import { PeriodicReviewForm } from "@/components/reviews/PeriodicReviewForm";
import { PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { periodLabel, rangeOfPeriod } from "@/lib/periodRanges";
import { toErrorMessage } from "@/lib/errorMessage";
import { takenTrades, missedTrades } from "@/lib/stats";
import type { PeriodicReview, PeriodicReviewInput, Trade, WeeklyReview, WeeklyReviewInput } from "@/lib/types";

type ReviewTab = "week" | PeriodType;

const TABS: { key: ReviewTab; label: string }[] = [
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "quarter", label: "Quarterly" },
  { key: "year", label: "Yearly" },
];

export default function ReviewsPage() {
  const [tab, setTab] = useState<ReviewTab>("week");
  const { trades, refresh: refreshTrades } = useTrades({ type: "live" });

  return (
    <>
      <PageHeader title="Reviews" />

      <div className="flex gap-1 mb-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "px-4 py-2 font-body text-sm -mb-px border-b-2 transition-colors",
              tab === t.key ? "border-gold text-ink" : "border-transparent text-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "week" ? (
        <WeeklyReviewsTab trades={trades} refreshTrades={refreshTrades} />
      ) : (
        <PeriodicReviewsTab periodType={tab} trades={trades} />
      )}
    </>
  );
}

function WeeklyReviewsTab({ trades, refreshTrades }: { trades: Trade[]; refreshTrades: () => Promise<void> }) {
  const { reviews, loading, createReview, updateReview, deleteReview, linkTradesToReview } = useWeeklyReviews();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<WeeklyReview | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && reviews.length > 0) setSelectedId(reviews[0].id);
  }, [reviews, selectedId]);

  const selected = reviews.find((r) => r.id === selectedId) ?? null;

  const tradesByReview = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of trades) {
      if (!t.weekly_review_id) continue;
      const bucket = m.get(t.weekly_review_id) ?? [];
      bucket.push(t);
      m.set(t.weekly_review_id, bucket);
    }
    return m;
  }, [trades]);

  // Missed trades are hypothetical (see LinkedTradesPanel) — never counted toward a review's real resultaat/win-rate/trade-count.
  function takenTradesOf(review: WeeklyReview) {
    return takenTrades(tradesByReview.get(review.id) ?? []);
  }
  function resultaatOf(review: WeeklyReview): number {
    return Math.round(takenTradesOf(review).reduce((s, t) => s + t.resultaat_pct, 0) * 100) / 100;
  }
  function winRateOf(review: WeeklyReview): number {
    const taken = takenTradesOf(review);
    if (taken.length === 0) return 0;
    return taken.filter((t) => t.outcome === "Win").length / taken.length;
  }
  function tradeCountOf(review: WeeklyReview): number {
    return takenTradesOf(review).length;
  }

  function openCreate() {
    setEditingReview(undefined);
    setFormOpen(true);
  }
  function openEdit(review: WeeklyReview) {
    setEditingReview(review);
    setFormOpen(true);
  }

  async function handleSubmit(input: WeeklyReviewInput) {
    if (editingReview) {
      await updateReview(editingReview.id, input);
    } else {
      const created = await createReview(input);
      setSelectedId(created.id);
    }
  }

  async function handleDelete(review: WeeklyReview) {
    if (confirm(`Review W${review.week_nummer} · ${review.jaar} verwijderen?`)) {
      setError(null);
      try {
        await deleteReview(review.id);
        if (selectedId === review.id) setSelectedId(null);
      } catch (err) {
        setError(toErrorMessage(err, "Verwijderen van review is mislukt"));
      }
    }
  }

  async function handleRelink(reviewId: string, jaar: number, weekNummer: number): Promise<number> {
    const count = await linkTradesToReview(reviewId, jaar, weekNummer);
    await refreshTrades();
    return count;
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold">
          <Plus size={15} /> Nieuwe review
        </button>
      </div>

      {error && <p className="text-sm text-loss mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted text-sm">Laden...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ReviewList
            reviews={reviews}
            selectedId={selectedId}
            onSelect={setSelectedId}
            resultaatOf={resultaatOf}
            tradeCountOf={tradeCountOf}
          />
          {selected ? (
            <ReviewDetail
              review={selected}
              trades={trades}
              winRate={winRateOf(selected)}
              onEdit={() => openEdit(selected)}
              onDelete={() => void handleDelete(selected)}
              onRelink={handleRelink}
            />
          ) : (
            <div className="col-span-2 flex items-center justify-center text-sm text-muted">Selecteer of maak een review.</div>
          )}
        </div>
      )}

      {formOpen && <ReviewForm review={editingReview} onSubmit={handleSubmit} onClose={() => setFormOpen(false)} />}
    </>
  );
}

function tradesInPeriod(trades: Trade[], review: PeriodicReview): Trade[] {
  const { start, end } = rangeOfPeriod(review.period_type, review.jaar, review.periode_nummer);
  return trades.filter((t) => t.datum_open >= start && t.datum_open <= end);
}

function PeriodicReviewsTab({ periodType, trades }: { periodType: PeriodType; trades: Trade[] }) {
  const { reviews, loading, createReview, updateReview, deleteReview } = usePeriodicReviews(periodType);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PeriodicReview | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [periodType]);

  useEffect(() => {
    if (!selectedId && reviews.length > 0) setSelectedId(reviews[0].id);
  }, [reviews, selectedId]);

  const selected = reviews.find((r) => r.id === selectedId) ?? null;

  // Missed trades never count toward a period's real resultaat/win-rate/trade-count — same rule as the weekly review.
  function takenTradesOf(review: PeriodicReview) {
    return takenTrades(tradesInPeriod(trades, review));
  }
  function missedTradesOf(review: PeriodicReview) {
    return missedTrades(tradesInPeriod(trades, review));
  }
  function resultaatOf(review: PeriodicReview): number {
    return Math.round(takenTradesOf(review).reduce((s, t) => s + t.resultaat_pct, 0) * 100) / 100;
  }
  function winRateOf(review: PeriodicReview): number {
    const taken = takenTradesOf(review);
    if (taken.length === 0) return 0;
    return taken.filter((t) => t.outcome === "Win").length / taken.length;
  }
  function tradeCountOf(review: PeriodicReview): number {
    return takenTradesOf(review).length;
  }

  function openCreate() {
    setEditingReview(undefined);
    setFormOpen(true);
  }
  function openEdit(review: PeriodicReview) {
    setEditingReview(review);
    setFormOpen(true);
  }

  async function handleSubmit(input: PeriodicReviewInput) {
    if (editingReview) {
      await updateReview(editingReview.id, input);
    } else {
      const created = await createReview(input);
      setSelectedId(created.id);
    }
  }

  async function handleDelete(review: PeriodicReview) {
    if (confirm(`${PERIOD_TYPE_LABELS[periodType]} review "${periodLabel(review.period_type, review.jaar, review.periode_nummer)}" verwijderen?`)) {
      setError(null);
      try {
        await deleteReview(review.id);
        if (selectedId === review.id) setSelectedId(null);
      } catch (err) {
        setError(toErrorMessage(err, "Verwijderen van review is mislukt"));
      }
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold">
          <Plus size={15} /> Nieuwe {PERIOD_TYPE_LABELS[periodType].toLowerCase()} review
        </button>
      </div>

      {error && <p className="text-sm text-loss mb-4">{error}</p>}

      {loading ? (
        <p className="text-muted text-sm">Laden...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <PeriodicReviewList
            periodType={periodType}
            reviews={reviews}
            selectedId={selectedId}
            onSelect={setSelectedId}
            resultaatOf={resultaatOf}
            tradeCountOf={tradeCountOf}
          />
          {selected ? (
            <PeriodicReviewDetail
              review={selected}
              taken={takenTradesOf(selected)}
              missed={missedTradesOf(selected)}
              winRate={winRateOf(selected)}
              onEdit={() => openEdit(selected)}
              onDelete={() => void handleDelete(selected)}
            />
          ) : (
            <div className="col-span-2 flex items-center justify-center text-sm text-muted">Selecteer of maak een review.</div>
          )}
        </div>
      )}

      {formOpen && (
        <PeriodicReviewForm
          periodType={periodType}
          review={editingReview}
          trades={trades}
          onSubmit={handleSubmit}
          onClose={() => setFormOpen(false)}
        />
      )}
    </>
  );
}
