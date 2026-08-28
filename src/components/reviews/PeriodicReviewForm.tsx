import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { PeriodicReview, PeriodicReviewInput, Trade } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { PERIOD_TYPE_LABELS, type PeriodType } from "@/lib/constants";
import { dateLocale, monthName, tradesInResultUnit } from "@/lib/format";
import { useResultDisplay } from "@/hooks/useResultDisplay";
import { rangeOfPeriod } from "@/lib/periodRanges";
import { localTodayIso } from "@/lib/localDate";
import { takenTrades, missedTrades, closedTrades, computeErrorCounts } from "@/lib/stats";
import { toErrorMessage } from "@/lib/errorMessage";
import { ReviewFormModal } from "@/components/reviews/ReviewFormModal";
import { ReviewStatsHeader } from "@/components/reviews/ReviewStatsHeader";
import { ReviewErrorStats } from "@/components/reviews/ReviewErrorStats";
import { ReviewSectionsFields } from "@/components/reviews/ReviewSectionsFields";
import { initialReviewValues, buildPeriodicReviewContent, type ReviewSection, type ReviewValues } from "@/lib/reviewSections";
import { periodicExtraGroupModes } from "@/components/reviews/ReviewTradeGroups";
import { ReviewTradesPanel } from "@/components/reviews/ReviewTradesPanel";

interface PeriodicReviewFormProps {
  periodType: PeriodType;
  review?: PeriodicReview;
  /** This journal's resolved periodic review sections for this period type (Fase N5). */
  sections: ReviewSection[];
  trades: Trade[];
  onSubmit: (input: PeriodicReviewInput) => Promise<void>;
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
}

function defaultPeriodeNummer(periodType: PeriodType, now: Date): number {
  if (periodType === "month") return now.getMonth() + 1;
  return Math.floor(now.getMonth() / 3) + 1;
}

export function PeriodicReviewForm({ periodType, review, sections, trades, onSubmit, onAddTrade, onClose }: PeriodicReviewFormProps) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, i) => monthName(i, dateLocale(i18n.language)));
  const [jaar, setJaar] = useState(review?.jaar ?? now.getFullYear());
  const [periodeNummer, setPeriodeNummer] = useState(review?.periode_nummer ?? defaultPeriodeNummer(periodType, now));
  const [titel, setTitel] = useState(review?.titel ?? "");
  const [content, setContent] = useState<ReviewValues>(() => initialReviewValues(sections, review));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Sections can arrive AFTER mount (the journal's custom rows are still
  // fetching when the form opens — audit M1-b): merge-seed the late keys so a
  // shown section is never valueless — saving one would wipe its stored text.
  // Existing state wins: it holds the review-seeded values plus anything typed.
  useEffect(() => {
    setContent((cur) => ({ ...initialReviewValues(sections, review), ...cur }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

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
  const periodRange = useMemo(
    () => rangeOfPeriod(periodType, jaar, periodeNummerForRange),
    [periodType, jaar, periodeNummerForRange]
  );
  const tradesInPeriod = useMemo(
    () => trades.filter((t) => t.datum_open >= periodRange.start && t.datum_open <= periodRange.end),
    [trades, periodRange]
  );
  // A trade added inline defaults into the reviewed period: today if it falls inside it, else the period's first day.
  const today = localTodayIso();
  const newTradeDate = today >= periodRange.start && today <= periodRange.end ? today : periodRange.start;
  const takenPreview = takenTrades(tradesInPeriod);
  const missedPreview = missedTrades(tradesInPeriod);
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
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        period_type: periodType,
        jaar,
        periode_nummer: periodType === "year" ? null : periodeNummer,
        titel: titel || null,
        // Fold the section values into columns + the custom-section content bag (Fase N5).
        ...buildPeriodicReviewContent(sections, content, review),
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
      title={review ? t("reviewForm.editTitle") : t("reviewForm.newPeriodic", { type: PERIOD_TYPE_LABELS[periodType].toLowerCase() })}
      titleId="periodic-review-form-title"
      isDirty={dirty}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting}
      error={error}
    >
      {/* Titel hoort in dezelfde kop-rij als bij de weekly review (boven de
          grafiek), niet als losse regel eronder. Maand/kwartaal hebben 2
          periode-velden → 3 kolommen; het jaaroverzicht heeft er 1 → 2 kolommen. */}
      <div className={`grid ${periodType === "year" ? "grid-cols-2" : "grid-cols-3"} gap-4`}>
        {periodType === "month" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">{t("reviewForm.maand")}</label>
            <select className="input" value={periodeNummer} onChange={(e) => handlePeriodeNummerChange(Number(e.target.value))}>
              {monthOptions.map((m, i) => (
                <option key={m} value={i + 1} className="capitalize">
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        {periodType === "quarter" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">{t("reviewForm.kwartaal")}</label>
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

      <ReviewSectionsFields kind="periodic" sections={sections} values={content} onChange={handleContentChange} />

      <ReviewTradesPanel
        label={t("reviewForm.tradesInPeriod", { count: tradesInPeriod.length })}
        taken={takenPreview}
        missed={missedPreview}
        extraGroupModes={periodicExtraGroupModes(periodType)}
        onAddTrade={onAddTrade}
        initialDate={newTradeDate}
      />
    </ReviewFormModal>
  );
}
