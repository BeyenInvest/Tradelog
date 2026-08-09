import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Trade, WeeklyReview, WeeklyReviewInput } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { isoWeekOf, isoWeekRange } from "@/lib/isoWeek";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { ReviewContentFields, type ReviewContentValue } from "@/components/reviews/ReviewContentFields";
import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewTradesPanel } from "@/components/reviews/ReviewTradesPanel";

interface ReviewFormProps {
  review?: WeeklyReview;
  trades: Trade[];
  onSubmit: (input: WeeklyReviewInput) => Promise<void>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
}

function defaultWeek() {
  return isoWeekOf(new Date().toISOString().slice(0, 10));
}

export function ReviewForm({ review, trades, onSubmit, onAddTrade, onClose }: ReviewFormProps) {
  const { t } = useTranslation();
  const startWeek = review ? { jaar: review.jaar, week_nummer: review.week_nummer } : defaultWeek();
  const [jaar, setJaar] = useState(startWeek.jaar);
  const [weekNummer, setWeekNummer] = useState(startWeek.week_nummer);
  const [titel, setTitel] = useState(review?.titel ?? "");
  const [content, setContent] = useState<ReviewContentValue>({
    verhalen: review?.verhalen ?? "",
    technisch: review?.technisch ?? "",
    mentaal_owner: review?.mentaal_owner ?? "",
    mentaal_trader: review?.mentaal_trader ?? "",
    acties: review?.acties?.length ? review.acties : [""],
    takeaway: review?.takeaway ?? "",
    overall_comment: review?.overall_comment ?? "",
  });
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
  const today = new Date().toISOString().slice(0, 10);
  const newTradeDate = today >= weekRange.start && today <= weekRange.end ? today : weekRange.start;
  const takenPreview = takenTrades(tradesInWeek);
  const missedPreview = missedTrades(tradesInWeek);
  const errorCounts = useMemo(() => computeErrorCounts(takenPreview, missedPreview), [takenPreview, missedPreview]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        jaar,
        week_nummer: weekNummer,
        titel: titel || null,
        verhalen: content.verhalen || null,
        technisch: content.technisch || null,
        mentaal_owner: content.mentaal_owner || null,
        mentaal_trader: content.mentaal_trader || null,
        acties: content.acties.map((a) => a.trim()).filter(Boolean),
        takeaway: content.takeaway || null,
        overall_comment: content.overall_comment || null,
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
          <input type="number" min={1} max={53} className="input" value={weekNummer} onChange={(e) => handleWeekChange(Number(e.target.value))} />
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

      <ReviewStatsHeader taken={takenPreview} missed={missedPreview} />
      <ReviewErrorStats {...errorCounts} />

      <ReviewContentFields value={content} onChange={handleContentChange} />

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
