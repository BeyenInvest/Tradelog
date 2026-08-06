import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { OUTCOMES, TRADE_EVALUATIONS } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { Field } from "./Field";

function durationDays(open: string, close: string | null | undefined): number | null {
  if (!open || !close) return null;
  const ms = new Date(close).getTime() - new Date(open).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface ResultSectionProps {
  /** false when the form is opened from within a backtest project — "Missed trade" isn't a meaningful concept there. */
  allowMissedTrade: boolean;
}

export function ResultSection({ allowMissedTrade }: ResultSectionProps) {
  const { t } = useTranslation();
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<TradeFormValues>();
  const datumOpen = watch("datum_open");
  const datumSluiting = watch("datum_sluiting");
  const duur = durationDays(datumOpen, datumSluiting);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionResult")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("tradeForm.outcome")} error={errors.outcome?.message}>
          <EnumSelect options={OUTCOMES} {...register("outcome")} />
        </Field>
        <Field label={t("tradeForm.resultPct")} error={errors.resultaat_pct?.message}>
          <input type="number" step="0.01" className="input" {...register("resultaat_pct")} />
        </Field>
        {allowMissedTrade && (
          <Field label={t("tradeForm.tradeEvaluation")} error={errors.trade_evaluation?.message}>
            <EnumSelect options={TRADE_EVALUATIONS} {...register("trade_evaluation")} />
          </Field>
        )}
        {allowMissedTrade && (
          <Field label={t("tradeForm.tpfs")} error={errors.tpfs_pct?.message}>
            <input type="number" step="0.01" className="input" {...register("tpfs_pct")} />
          </Field>
        )}
        <Field label={t("tradeForm.datumSluiting")} error={errors.datum_sluiting?.message}>
          <input type="date" className="input" {...register("datum_sluiting")} />
        </Field>
        <Field label={t("tradeForm.durationDerived")}>
          <input type="text" disabled value={duur ?? ""} className="input opacity-60" />
        </Field>
      </div>
    </div>
  );
}
