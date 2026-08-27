import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { TriangleAlert, X } from "lucide-react";
import { tradeSchema, type TradeFormValues } from "@/lib/validation";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useMethodology } from "@/hooks/useMethodology";
import { normalizeInstrument } from "@/lib/instruments";
import { deriveOutcome } from "@/lib/import/mapToTrade";
import { toErrorMessage } from "@/lib/errorMessage";
import { localTodayIso } from "@/lib/localDate";
import { PAIRS, DIRECTIONS, SANITY_RESULT_PCT } from "@/lib/constants";
import { quickLogDefaults, QUICK_EVALUATIONS } from "@/lib/quickLog";
import { getLastInstrument, getLastRisk, setLastInstrument, setLastRisk } from "@/lib/tradeMemory";
import { Modal } from "@/components/ui/Modal";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { Field } from "./TradeFormSections/Field";

interface QuickLogFormProps {
  onSubmit: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
}

/**
 * Minimal post-session logger (Fase L, pro-uitbreiding Fase S1): instrument,
 * direction, result %, planned risk, an optional note and the trade date — a
 * trade in seconds, the rest filled in later via the full edit form. Validated
 * against the same tradeSchema as TradeForm (no second truth); the remaining
 * columns are silently defaulted (quickLogDefaults).
 *
 * "Bewaar & volgende" keeps the modal open and only clears result/evaluation/
 * note, so a back-to-back logging session (a whole trading day at once) keeps
 * the instrument, direction, risk and date you're repeating. Instrument + risk
 * are remembered per journal (tradeMemory) so the next open pre-fills them too.
 */
export function QuickLogForm({ onSubmit, onClose }: QuickLogFormProps) {
  const { t } = useTranslation();
  const { methodology, isForexJournal, faseNames } = useMethodology();
  const methodologyId = methodology?.id ?? null;

  const methods = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: (() => {
      const base = quickLogDefaults(faseNames[0] ?? "Fase 1", localTodayIso());
      const lastRisk = getLastRisk(methodologyId);
      const lastInstrument = getLastInstrument(methodologyId);
      if (lastRisk != null) base.risk_pct = lastRisk;
      // Prefill the symbol you last logged in this journal: the pair enum for a
      // forex journal (only when the remembered value is still a valid pair),
      // the free instrument field otherwise.
      if (lastInstrument) {
        if (isForexJournal) {
          if ((PAIRS as readonly string[]).includes(lastInstrument)) base.pair = lastInstrument as typeof base.pair;
        } else {
          base.instrument = lastInstrument;
        }
      }
      return base;
    })(),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    setError: setFieldError,
    formState: { isSubmitting, isDirty, errors },
  } = methods;
  const [error, setError] = useState<string | null>(null);

  // Keep `outcome` in lockstep with the sign of the result so tradeSchema's
  // win/loss-sign guard is always satisfied and the derived Win/Loss/BE shown
  // below matches what gets saved.
  const resultaatRaw = watch("resultaat_pct");
  const resultaatNum = Number(resultaatRaw) || 0;
  const derivedOutcome = deriveOutcome(resultaatNum);
  useEffect(() => {
    setValue("outcome", derivedOutcome);
  }, [derivedOutcome, setValue]);

  // Soft sanity check: a result past ±20% is almost always a mis-typed decimal.
  // Non-blocking — just a hint, saving is never gated on it.
  const sanityWarning = Math.abs(resultaatNum) > SANITY_RESULT_PCT;

  const directionValue = watch("direction");

  async function handleQuickSubmit(values: TradeFormValues, keepOpen: boolean) {
    setError(null);
    // A non-forex journal needs a real instrument (a blank would fall back to the
    // hidden placeholder pair in every list/breakdown). A forex journal's
    // instrument IS its pair.
    const instrument = isForexJournal ? values.pair : normalizeInstrument(values.instrument ?? "") || null;
    if (!isForexJournal && !instrument) {
      setFieldError("instrument", { type: "required", message: "tradeForm.required" });
      return;
    }
    try {
      await onSubmit({
        ...values,
        outcome: deriveOutcome(Number(values.resultaat_pct) || 0),
        // Same system-template guard as TradeForm: useMethodology falls back to
        // the shared WPM template when the profile has no journal, and stamping
        // that id gets rejected by trg_trades_journal_ownership — which made
        // every quick-log save fail for a fresh account that skipped onboarding.
        methodology_id: methodology && !methodology.is_system ? methodology.id : null,
        instrument,
        // Quick-log never collects custom fields — always the empty bag (also
        // narrows TradeFormValues' Record<string, unknown> to the submit shape).
        custom: {},
      });
      // Remember what you'll most likely repeat next time (per journal).
      setLastInstrument(methodologyId, instrument);
      setLastRisk(methodologyId, values.risk_pct);
      if (keepOpen) {
        // Reset for the next trade, keeping the shared context (instrument,
        // direction, risk, date) and clearing only the per-trade fields.
        reset({
          ...values,
          resultaat_pct: 0,
          outcome: "BE",
          trade_evaluation: null,
          notes: null,
        });
      } else {
        onClose();
      }
    } catch (err) {
      setError(toErrorMessage(err, t("tradeForm.saveFailed")));
    }
  }

  return (
    <Modal labelledBy="quick-log-title" maxWidthClass="max-w-md" isDirty={isDirty} onClose={onClose}>
      {(requestClose) => (
        <FormProvider {...methods}>
          <div className="flex items-center justify-between mb-1">
            <h2 id="quick-log-title" className="font-display text-xl italic text-ink">
              {t("quickLog.title")}
            </h2>
            <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-muted mb-5">{t("quickLog.subtitle")}</p>

          <form onSubmit={handleSubmit((v) => handleQuickSubmit(v, false))} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("quickLog.instrument")} error={errors.instrument?.message}>
                {isForexJournal ? (
                  <select className="input" {...register("pair")}>
                    {PAIRS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" className="input" placeholder={t("quickLog.instrumentPlaceholder")} {...register("instrument")} />
                )}
              </Field>

              <Field label={t("quickLog.date")} error={errors.datum_open?.message}>
                <input type="date" className="input" {...register("datum_open")} />
              </Field>
            </div>

            <Field label={t("quickLog.direction")}>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                {DIRECTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue("direction", directionValue === d ? null : d, { shouldDirty: true })}
                    className={`px-4 py-2 text-sm font-body transition-colors ${
                      directionValue === d ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label={t("quickLog.result")} error={errors.resultaat_pct?.message}>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input type="number" step="0.01" className="input" {...register("resultaat_pct")} />
                  </div>
                  <OutcomePill outcome={derivedOutcome} />
                </div>
              </Field>

              <Field label={t("quickLog.risk")} error={errors.risk_pct?.message}>
                <input type="number" step="0.01" min="0" placeholder="1" className="input" {...register("risk_pct")} />
              </Field>
            </div>

            {sanityWarning && (
              <p className="flex items-center gap-1.5 text-xs text-gold -mt-1">
                <TriangleAlert size={13} /> {t("tradeForm.sanityWarning", { pct: SANITY_RESULT_PCT })}
              </p>
            )}

            <Field label={t("quickLog.evaluation")}>
              <EnumSelect
                options={QUICK_EVALUATIONS}
                placeholder={t("quickLog.evaluationNone")}
                className="input"
                {...register("trade_evaluation")}
              />
            </Field>

            <Field label={t("quickLog.note")}>
              <input type="text" className="input" placeholder={t("quickLog.notePlaceholder")} {...register("notes")} />
            </Field>

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
                {t("common.cancel")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSubmit((v) => handleQuickSubmit(v, true))}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5 disabled:opacity-60"
                >
                  {t("quickLog.saveAndNext")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
                >
                  {isSubmitting ? t("common.submitting") : t("quickLog.save")}
                </button>
              </div>
            </div>
          </form>
        </FormProvider>
      )}
    </Modal>
  );
}
