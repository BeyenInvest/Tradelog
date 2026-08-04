import { useFormContext } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { OUTCOMES, TRADE_EVALUATIONS, TRADE_EVALUATIONS_NO_MISSED } from "@/lib/constants";
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
      <h3 className="font-display text-lg italic text-ink">Result</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Outcome" error={errors.outcome?.message}>
          <EnumSelect options={OUTCOMES} {...register("outcome")} />
        </Field>
        <Field label="Resultaat % (R)" error={errors.resultaat_pct?.message}>
          <input type="number" step="0.01" className="input" {...register("resultaat_pct")} />
        </Field>
        <Field label="Trade evaluation" error={errors.trade_evaluation?.message}>
          <EnumSelect options={allowMissedTrade ? TRADE_EVALUATIONS : TRADE_EVALUATIONS_NO_MISSED} {...register("trade_evaluation")} />
        </Field>
        <Field label="TPFS % (optioneel)" error={errors.tpfs_pct?.message}>
          <input type="number" step="0.01" className="input" {...register("tpfs_pct")} />
        </Field>
        <Field label="Datum sluiting" error={errors.datum_sluiting?.message}>
          <input type="date" className="input" {...register("datum_sluiting")} />
        </Field>
        <Field label="Duur (dagen, afgeleid)">
          <input type="text" disabled value={duur ?? ""} className="input opacity-60" />
        </Field>
      </div>
    </div>
  );
}
