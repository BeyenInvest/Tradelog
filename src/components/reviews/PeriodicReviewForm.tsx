import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { PeriodicReview, PeriodicReviewInput, Trade } from "@/lib/types";
import { MONTH_NAMES, PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { rangeOfPeriod } from "@/lib/periodRanges";
import { computeEquityCurve, computeOutcomeCounts, takenTrades, missedTrades } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { useModalGuard } from "@/hooks/useModalGuard";
import { WinRatePieChart } from "@/components/charts/WinRatePieChart";
import { EquityCurveChart } from "@/components/charts/EquityCurveChart";
import { ReviewContentFields, type ReviewContentValue } from "@/components/reviews/ReviewContentFields";
import { TradeRows } from "@/components/reviews/TradeRows";

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
  const outcomeCounts = useMemo(() => computeOutcomeCounts(takenPreview), [takenPreview]);
  const equityData = useMemo(() => computeEquityCurve(takenPreview), [takenPreview]);
  const emotionalErrorCount = takenPreview.filter((t) => t.trade_evaluation === "Emotional error").length;
  const technicalErrorCount = takenPreview.filter((t) => t.trade_evaluation === "Technical error").length;

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
          <h2 className="font-display text-2xl italic text-ink">
            {review ? "Review bewerken" : `Nieuwe ${PERIOD_TYPE_LABELS[periodType].toLowerCase()} review`}
          </h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-white/5 text-muted">
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

          <div className="flex flex-col gap-4 rounded-lg p-4 bg-bg border border-border">
            <div className="flex items-center justify-between font-mono text-sm">
              <span>
                <span className="text-win">{outcomeCounts.wins}</span> win ·{" "}
                <span className="text-be">{outcomeCounts.be}</span> be ·{" "}
                <span className="text-loss">{outcomeCounts.losses}</span> loss
              </span>
              <span className="text-muted">{outcomeCounts.n} trades genomen</span>
            </div>
            <div className="flex gap-4 font-mono text-xs text-muted">
              <span>{emotionalErrorCount} emotional error{emotionalErrorCount === 1 ? "" : "s"}</span>
              <span>{technicalErrorCount} technical error{technicalErrorCount === 1 ? "" : "s"}</span>
              <span>{missedPreview.length} missed trade{missedPreview.length === 1 ? "" : "s"}</span>
            </div>
            <div className="flex justify-center">
              <WinRatePieChart wins={outcomeCounts.wins} be={outcomeCounts.be} losses={outcomeCounts.losses} />
            </div>
          </div>

          {takenPreview.length > 0 && (
            <div>
              <p className="font-body text-xs uppercase tracking-wider mb-2 text-muted">Cumulatief resultaat</p>
              <EquityCurveChart data={equityData} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">Titel</label>
            <input type="text" className="input" value={titel} onChange={(e) => handleTitelChange(e.target.value)} />
          </div>

          <ReviewContentFields value={content} onChange={handleContentChange} />

          <div className="flex flex-col gap-3 rounded-lg p-4 bg-bg border border-border">
            <p className="font-body text-xs uppercase tracking-wider text-muted">Trades in periode ({tradesInPeriod.length})</p>
            <TradeRows label="Trades genomen" rows={takenPreview} emptyLabel="Geen genomen trades." />
            <TradeRows label="Missed trades" rows={missedPreview} emptyLabel="Geen missed trades deze periode." muted />
          </div>

          {error && <p className="text-sm text-loss">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
              Annuleren
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-bg disabled:opacity-60">
              {submitting ? "Bezig..." : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
