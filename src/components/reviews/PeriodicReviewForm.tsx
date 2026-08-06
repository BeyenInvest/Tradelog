import { useMemo, useState, type FormEvent } from "react";
import type { PeriodicReview, PeriodicReviewInput, Trade } from "@/lib/types";
import { MONTH_NAMES, PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { rangeOfPeriod } from "@/lib/periodRanges";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { PeriodicReviewContentFields, type PeriodicReviewContentValue } from "@/components/reviews/PeriodicReviewContentFields";
import { ReviewTradeGroups, periodicExtraGroupModes } from "@/components/reviews/ReviewTradeGroups";

interface PeriodicReviewFormProps {
  periodType: PeriodType;
  review?: PeriodicReview;
  trades: Trade[];
  onSubmit: (input: PeriodicReviewInput) => Promise<void>;
  onClose: () => void;
}

function defaultPeriodeNummer(periodType: PeriodType, now: Date): number {
  if (periodType === "month") return now.getMonth() + 1;
  return Math.floor(now.getMonth() / 3) + 1;
}

export function PeriodicReviewForm({ periodType, review, trades, onSubmit, onClose }: PeriodicReviewFormProps) {
  const now = new Date();
  const [jaar, setJaar] = useState(review?.jaar ?? now.getFullYear());
  const [periodeNummer, setPeriodeNummer] = useState(review?.periode_nummer ?? defaultPeriodeNummer(periodType, now));
  const [titel, setTitel] = useState(review?.titel ?? "");
  const [content, setContent] = useState<PeriodicReviewContentValue>({
    technisch: review?.technisch ?? "",
    mentaal_owner: review?.mentaal_owner ?? "",
    mentaal_trader: review?.mentaal_trader ?? "",
    acties: review?.acties?.length ? review.acties : [""],
    takeaway: review?.takeaway ?? "",
    overall_comment: review?.overall_comment ?? "",
    periode_overzicht: review?.periode_overzicht ?? "",
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
  const handlePeriodeNummerChange = withDirty(setPeriodeNummer);
  const handleTitelChange = withDirty(setTitel);
  const handleContentChange = withDirty(setContent);

  const periodeNummerForRange = periodType === "year" ? null : periodeNummer;
  const tradesInPeriod = useMemo(() => {
    const { start, end } = rangeOfPeriod(periodType, jaar, periodeNummerForRange);
    return trades.filter((t) => t.datum_open >= start && t.datum_open <= end);
  }, [trades, periodType, jaar, periodeNummerForRange]);
  const takenPreview = takenTrades(tradesInPeriod);
  const missedPreview = missedTrades(tradesInPeriod);
  const errorCounts = useMemo(() => computeErrorCounts(takenPreview, missedPreview), [takenPreview, missedPreview]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        period_type: periodType,
        jaar,
        periode_nummer: periodType === "year" ? null : periodeNummer,
        titel: titel || null,
        technisch: content.technisch || null,
        mentaal_owner: content.mentaal_owner || null,
        mentaal_trader: content.mentaal_trader || null,
        acties: content.acties.map((a) => a.trim()).filter(Boolean),
        takeaway: content.takeaway || null,
        overall_comment: content.overall_comment || null,
        periode_overzicht: content.periode_overzicht || null,
      });
      onClose();
    } catch (err) {
      setError(toErrorMessage(err, "Opslaan van de review is mislukt"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ReviewFormModal
      title={review ? "Review bewerken" : `Nieuwe ${PERIOD_TYPE_LABELS[periodType].toLowerCase()} review`}
      titleId="periodic-review-form-title"
      isDirty={dirty}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      <div className="grid grid-cols-2 gap-4">
        {periodType === "month" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">Maand</label>
            <select className="input" value={periodeNummer} onChange={(e) => handlePeriodeNummerChange(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        {periodType === "quarter" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">Kwartaal</label>
            <select className="input" value={periodeNummer} onChange={(e) => handlePeriodeNummerChange(Number(e.target.value))}>
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">Jaar</label>
          <input type="number" className="input" value={jaar} onChange={(e) => handleJaarChange(Number(e.target.value))} />
        </div>
      </div>

      <ReviewStatsHeader taken={takenPreview} missed={missedPreview} />
      <ReviewErrorStats {...errorCounts} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted">Titel</label>
        <input type="text" className="input" value={titel} onChange={(e) => handleTitelChange(e.target.value)} />
      </div>

      <PeriodicReviewContentFields periodType={periodType} value={content} onChange={handleContentChange} />

      <div className="flex flex-col gap-3 rounded-lg p-4 bg-bg border border-border">
        <p className="font-body text-xs uppercase tracking-wider text-muted">Trades in periode ({tradesInPeriod.length})</p>
        <ReviewTradeGroups taken={takenPreview} missed={missedPreview} extraGroupModes={periodicExtraGroupModes(periodType)} />
      </div>
    </ReviewFormModal>
  );
}
