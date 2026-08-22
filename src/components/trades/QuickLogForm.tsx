import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { tradeSchema, type TradeFormValues } from "@/lib/validation";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useMethodology } from "@/hooks/useMethodology";
import { normalizeInstrument } from "@/lib/instruments";
import { deriveOutcome } from "@/lib/import/mapToTrade";
import { toErrorMessage } from "@/lib/errorMessage";
import { localTodayIso } from "@/lib/localDate";
import { PAIRS, DIRECTIONS } from "@/lib/constants";
import { quickLogDefaults, QUICK_EVALUATIONS } from "@/lib/quickLog";
import { Modal } from "@/components/ui/Modal";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { Field } from "./TradeFormSections/Field";

interface QuickLogFormProps {
  onSubmit: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
}

/**
 * Minimal post-session logger (Fase L): instrument, direction, result %, and
 * evaluation — a trade in under 30 seconds, details filled in later via the full
 * edit form. Validated against the same tradeSchema as TradeForm (no second
 * truth); the rest of the row is silently defaulted (quickDefaults).
 */
export function QuickLogForm({ onSubmit, onClose }: QuickLogFormProps) {
  const { t } = useTranslation();
  const { methodology, isForexJournal, faseNames } = useMethodology();
  const methods = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: quickLogDefaults(faseNames[0] ?? "Fase 1", localTodayIso()),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError: setFieldError,
    formState: { isSubmitting, isDirty, errors },
  } = methods;
  const [error, setError] = useState<string | null>(null);

  // Keep `outcome` in lockstep with the sign of the result so tradeSchema's
  // win/loss-sign guard is always satisfied and the derived Win/Loss/BE shown
  // below matches what gets saved.
  const resultaatRaw = watch("resultaat_pct");
  const derivedOutcome = deriveOutcome(Number(resultaatRaw) || 0);
  useEffect(() => {
    setValue("outcome", derivedOutcome);
  }, [derivedOutcome, setValue]);

  const directionValue = watch("direction");

  async function handleQuickSubmit(values: TradeFormValues) {
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
        methodology_id: methodology?.id ?? null,
        instrument,
        // Quick-log never collects custom fields — always the empty bag (also
        // narrows TradeFormValues' Record<string, unknown> to the submit shape).
        custom: {},
      });
      onClose();
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

          <form onSubmit={handleSubmit(handleQuickSubmit)} className="flex flex-col gap-4">
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

            <Field label={t("quickLog.result")} error={errors.resultaat_pct?.message}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input type="number" step="0.01" className="input" {...register("resultaat_pct")} />
                </div>
                <OutcomePill outcome={derivedOutcome} />
              </div>
            </Field>

            <Field label={t("quickLog.evaluation")}>
              <EnumSelect
                options={QUICK_EVALUATIONS}
                placeholder={t("quickLog.evaluationNone")}
                className="input"
                {...register("trade_evaluation")}
              />
            </Field>

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
              >
                {isSubmitting ? t("common.submitting") : t("quickLog.save")}
              </button>
            </div>
          </form>
        </FormProvider>
      )}
    </Modal>
  );
}
