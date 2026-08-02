import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Trade, WeeklyReview, WeeklyReviewInput } from "@/lib/types";
import { isoWeekOf, isoWeekRange } from "@/lib/isoWeek";
import { takenTrades, missedTrades, computeErrorCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { useModalGuard } from "@/hooks/useModalGuard";
import { ReviewContentFields, type ReviewContentValue } from "@/components/reviews/ReviewContentFields";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewTradeGroups } from "@/components/reviews/ReviewTradeGroups";

interface ReviewFormProps {
  review?: WeeklyReview;
  trades: Trade[];
  onSubmit: (input: WeeklyReviewInput) => Promise<void>;
  onClose: () => void;
}

function defaultWeek() {
  return isoWeekOf(new Date().toISOString().slice(0, 10));
}

export function ReviewForm({ review, trades, onSubmit, onClose }: ReviewFormProps) {
  const startWeek = review ? { jaar: review.jaar, week_nummer: review.week_nummer } : defaultWeek();
  const [jaar, setJaar] = useState(startWeek.jaar);
  const [weekNummer, setWeekNummer] = useState(startWeek.week_nummer);
  const [titel, setTitel] = useState(review?.titel ?? "");
  const [content, setContent] = useState<ReviewContentValue>({
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
  const requestClose = useModalGuard(dirty, onClose);

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

  const tradesInWeek = useMemo(() => {
    const { start, end } = isoWeekRange(jaar, weekNummer);
    return trades.filter((t) => t.datum_open >= start && t.datum_open <= end);
  }, [trades, jaar, weekNummer]);
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
        technisch: content.technisch || null,
        mentaal_owner: content.mentaal_owner || null,
        mentaal_trader: content.mentaal_trader || null,
        acties: content.acties.map((a) => a.trim()).filter(Boolean),
        takeaway: content.takeaway || null,
        overall_comment: content.overall_comment || null,
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
      <div className="w-full max-w-2xl h-full bg-surface border-l border-border overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl italic text-ink">{review ? "Review bewerken" : "Nieuwe weekly review"}</h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Week</label>
              <input type="number" min={1} max={53} className="input" value={weekNummer} onChange={(e) => handleWeekChange(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Jaar</label>
              <input type="number" className="input" value={jaar} onChange={(e) => handleJaarChange(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Titel</label>
              <input type="text" className="input" value={titel} onChange={(e) => handleTitelChange(e.target.value)} />
            </div>
          </div>

          <ReviewStatsHeader taken={takenPreview} missed={missedPreview} />
          <ReviewErrorStats {...errorCounts} />

          <ReviewContentFields value={content} onChange={handleContentChange} />

          <div className="flex flex-col gap-3 rounded-lg p-4 bg-bg border border-border">
            <p className="font-body text-xs uppercase tracking-wider text-muted">Trades in week ({tradesInWeek.length})</p>
            <ReviewTradeGroups taken={takenPreview} missed={missedPreview} />
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
