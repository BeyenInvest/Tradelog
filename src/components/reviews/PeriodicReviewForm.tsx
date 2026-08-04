import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { PeriodicReview, PeriodicReviewInput, Trade } from "@/lib/types";
import { MONTH_NAMES, PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { rangeOfPeriod } from "@/lib/periodRanges";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { useModalGuard } from "@/hooks/useModalGuard";
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
  const { requestClose, containerRef } = useModalGuard<HTMLDivElement>(dirty, onClose);

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
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="periodic-review-form-title"
        className="w-full max-w-2xl h-full bg-surface border-l border-border overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="periodic-review-form-title" className="font-display text-2xl italic text-ink">
            {review ? "Review bewerken" : `Nieuwe ${PERIOD_TYPE_LABELS[periodType].toLowerCase()} review`}
          </h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

          {error && <p className="text-sm text-loss">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
              Annuleren
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60">
              {submitting ? "Bezig..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
