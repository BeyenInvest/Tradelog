import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Trade, WeeklyReview, WeeklyReviewInput } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { isoWeekOf, isoWeekRange, weeksInIsoYear } from "@/lib/isoWeek";
import { localTodayIso } from "@/lib/localDate";
import { takenTrades, missedTrades, closedTrades, computeErrorCounts } from "@/lib/stats";
import { tradesInResultUnit } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { toErrorMessage } from "@/lib/errorMessage";
import { ReviewSectionsFields } from "@/components/reviews/ReviewSectionsFields";
import { initialReviewValues, buildWeeklyReviewContent, type ReviewSection, type ReviewValues } from "@/lib/reviewSections";
import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewTradesPanel } from "@/components/reviews/ReviewTradesPanel";

interface ReviewFormProps {
  review?: WeeklyReview;
  /** This journal's resolved weekly review sections (Fase N5) — drives the editor fields + submit shape. */
  sections: ReviewSection[];
  trades: Trade[];
  onSubmit: (input: WeeklyReviewInput) => Promise<void>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
}

function defaultWeek() {
  return isoWeekOf(localTodayIso());
}

export function ReviewForm({ review, sections, trades, onSubmit, onAddTrade, onClose }: ReviewFormProps) {
  const { t } = useTranslation();
  const startWeek = review ? { jaar: review.jaar, week_nummer: review.week_nummer } : defaultWeek();
  const [jaar, setJaar] = useState(startWeek.jaar);
  const [weekNummer, setWeekNummer] = useState(startWeek.week_nummer);
  const [titel, setTitel] = useState(review?.titel ?? "");
  const [content, setContent] = useState<ReviewValues>(() => initialReviewValues(sections, review));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function withDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setDirty(true);
      setter(v);
    };
  }
  const handleJaarChange = withDirty(setJaar);
  const handleWeekChange = withDirty(setWeekNummer);
  const handleTitelChange = withDirty(setTitel);
  const handleContentChange = withDirty(setContent);

  const weekRange = useMemo(() => isoWeekRange(jaar, weekNummer), [jaar, weekNummer]);
  const tradesInWeek = useMemo(
    () => trades.filter((t) => t.datum_open >= weekRange.start && t.datum_open <= weekRange.end),
    [trades, weekRange]
  );
  // A trade added inline should default into the week under review: today if it falls in that
  // week (the common "I just spotted a missed trade" case), otherwise the week's first day.
  const today = localTodayIso();
  const newTradeDate = today >= weekRange.start && today <= weekRange.end ? today : weekRange.start;
  const takenPreview = takenTrades(tradesInWeek);
  const missedPreview = missedTrades(tradesInWeek);
  // Realized-stats input excludes still-running open trades (missed rows are closed);
  // the raw previews still drive the display panel below.
  const takenClosed = closedTrades(takenPreview);
  const missedClosed = closedTrades(missedPreview);
  // In de eenheid van de kijker (Fase J): counts veranderen niet, alleen missedResultaat.
  const { unit: resultUnit, saldo } = useResultDisplay();
  const errorCounts = useMemo(
    () => computeErrorCounts(takenPreview, tradesInResultUnit(missedClosed, resultUnit, saldo)),
    [takenPreview, missedClosed, resultUnit, saldo]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Week 53 only exists in some ISO years — an out-of-range week would silently
    // shift the range into the next year (relink would then grab January trades).
    const maxWeek = weeksInIsoYear(jaar);
    if (!Number.isInteger(weekNummer) || weekNummer < 1 || weekNummer > maxWeek) {
      setError(t("reviewForm.invalidWeek", { jaar, maxWeek }));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        jaar,
        week_nummer: weekNummer,
        titel: titel || null,
        // Fold the section values into columns + the custom-section content bag (Fase N5).
        ...buildWeeklyReviewContent(sections, content, review),
      });
      onClose();
    } catch (err) {
      setError(toErrorMessage(err, t("reviewForm.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ReviewFormModal
      title={review ? t("reviewForm.editTitle") : t("reviewForm.newWeekly")}
      titleId="review-form-title"
      isDirty={dirty}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">{t("reviewForm.week")}</label>
          <input type="number" min={1} max={weeksInIsoYear(jaar)} className="input" value={weekNummer} onChange={(e) => handleWeekChange(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">{t("reviewForm.jaar")}</label>
          <input type="number" className="input" value={jaar} onChange={(e) => handleJaarChange(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">{t("reviewForm.titel")}</label>
          <input type="text" className="input" value={titel} onChange={(e) => handleTitelChange(e.target.value)} />
        </div>
      </div>

      <ReviewStatsHeader taken={takenClosed} missed={missedClosed} />
      <ReviewErrorStats {...errorCounts} />

      <ReviewSectionsFields kind="weekly" sections={sections} values={content} onChange={handleContentChange} />

      <ReviewTradesPanel
        label={t("reviewForm.tradesInWeek", { count: tradesInWeek.length })}
        taken={takenPreview}
        missed={missedPreview}
        onAddTrade={onAddTrade}
        initialDate={newTradeDate}
      />
    </ReviewFormModal>
  );
}
