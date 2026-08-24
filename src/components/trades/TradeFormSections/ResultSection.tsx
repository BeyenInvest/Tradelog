import { useEffect } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import type { TradeFormValues } from "@/lib/validation";
import { OUTCOMES, SANITY_RESULT_PCT, TRADE_EVALUATIONS } from "@/lib/constants";
import { deriveOutcome } from "@/lib/import/mapToTrade";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";

function durationDays(open: string, close: string | null | undefined): number | null {
  if (!open || !close) return null;
  const ms = new Date(close).getTime() - new Date(open).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface ResultSectionProps {
  /** false when the form is opened from within a backtest project — "Missed trade" isn't a meaningful concept there. */
  allowMissedTrade: boolean;
  /** Shared with EntrySection: set to true once the user edits the close date, so it stops auto-following the open date. */
  closeDateTouchedRef: React.MutableRefObject<boolean>;
}

export function ResultSection({ allowMissedTrade, closeDateTouchedRef }: ResultSectionProps) {
  const { t } = useTranslation();
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<TradeFormValues>();
  const datumOpen = watch("datum_open");
  const datumSluiting = watch("datum_sluiting");
  const duur = durationDays(datumOpen, datumSluiting);
  // A still-running trade is a live-Journal concept only (a backtest logs history,
  // which is by definition already closed) — gated on the same flag as "Missed trade".
  const isOpen = allowMissedTrade && watch("is_open");

  const outcome = watch("outcome");
  const resultRaw = watch("resultaat_pct");
  const resultNum = Number(resultRaw);
  const hasResult = resultRaw != null && String(resultRaw) !== "" && Number.isFinite(resultNum);

  // Invoerfrictie (Fase S1): let the outcome follow the sign of the result — the
  // same pattern quick-log uses. Deliberately non-fighting: it only fixes an
  // outright contradiction (a Loss typed as +, a Win typed as −) or fills an
  // empty outcome, and never overrides a deliberate BE. This removes the two
  // sign-guard validation errors before they can ever fire.
  useEffect(() => {
    if (isOpen || !hasResult) return;
    if (outcome === "Loss" && resultNum > 0) setValue("outcome", "Win", { shouldValidate: true });
    else if (outcome === "Win" && resultNum < 0) setValue("outcome", "Loss", { shouldValidate: true });
    else if (outcome == null) setValue("outcome", deriveOutcome(resultNum), { shouldValidate: true });
  }, [isOpen, hasResult, outcome, resultNum, setValue]);

  // Soft sanity check: a result past ±20% is almost always a mis-typed decimal.
  // Non-blocking — just a hint next to the field, saving is never gated on it.
  const sanityWarning = !isOpen && hasResult && Math.abs(resultNum) > SANITY_RESULT_PCT;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionResult")}</h3>

      {allowMissedTrade && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-body text-sm text-muted">{t("tradeForm.tradeStatus")}</span>
          <Controller
            name="is_open"
            control={control}
            render={({ field }) => (
              <BooleanToggle
                value={field.value ?? false}
                onChange={field.onChange}
                labels={[t("tradeForm.statusOpen"), t("tradeForm.statusClosed")]}
              />
            )}
          />
          {isOpen && <span className="font-body text-xs text-muted">{t("tradeForm.stillOpenHint")}</span>}
        </div>
      )}

      {isOpen ? (
        // Running trade: no realized result yet — only capture the planned risk it
        // was taken with. Outcome/result/close-date/evaluation are filled in later
        // when the trade is closed.
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("tradeForm.plannedRisk")} error={errors.risk_pct?.message}>
            <input type="number" step="0.01" min="0" placeholder="1" className="input" {...register("risk_pct")} />
          </Field>
        </div>
      ) : (
        // One grid so the fields reflow cleanly when "Trade evaluation" is hidden
        // (backtest scope): the live Journal shows 6 fields as three tidy pairs, a
        // backtest shows 5 and the single empty cell trails at the bottom (after the
        // derived Duration) instead of leaving a hole beside Outcome up top.
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("tradeForm.outcome")} error={errors.outcome?.message}>
            <EnumSelect options={OUTCOMES} {...register("outcome")} />
          </Field>
          {allowMissedTrade && (
            <Field label={t("tradeForm.tradeEvaluation")} error={errors.trade_evaluation?.message}>
              <EnumSelect options={TRADE_EVALUATIONS} {...register("trade_evaluation")} />
            </Field>
          )}
          <Field label={t("tradeForm.resultPct")} error={errors.resultaat_pct?.message} hint={t("tradeForm.resultSignHint")}>
            <input type="number" step="0.01" className="input" {...register("resultaat_pct")} />
          </Field>
          <Field label={t("tradeForm.datumSluiting")} error={errors.datum_sluiting?.message}>
            <input
              type="date"
              className="input"
              {...register("datum_sluiting", {
                onChange: () => {
                  // From now on the close date is user-owned; stop auto-following the open date.
                  closeDateTouchedRef.current = true;
                },
              })}
            />
          </Field>
          <Field label={t("tradeForm.plannedRisk")} error={errors.risk_pct?.message}>
            <input type="number" step="0.01" min="0" placeholder="1" className="input" {...register("risk_pct")} />
          </Field>
          <Field label={t("tradeForm.durationDerived")}>
            <input type="text" disabled value={duur ?? ""} className="input opacity-60" />
          </Field>
        </div>
      )}

      {sanityWarning && (
        <p className="flex items-center gap-1.5 text-xs text-gold -mt-1">
          <TriangleAlert size={13} /> {t("tradeForm.sanityWarning", { pct: SANITY_RESULT_PCT })}
        </p>
      )}
    </div>
  );
}
