import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { DIRECTIONS, PAIRS } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { useMethodology } from "@/hooks/useMethodology";
import { InstrumentSelect } from "../InstrumentSelect";
import { Field } from "./Field";

interface EntrySectionProps {
  /** Shared with ResultSection: false while the close date still auto-follows the open date. */
  closeDateTouchedRef: React.MutableRefObject<boolean>;
}

export function EntrySection({ closeDateTouchedRef }: EntrySectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TradeFormValues>();
  const { t } = useTranslation();
  const { isForexJournal, instruments, addInstrument } = useMethodology();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionEntry")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("tradeForm.datumOpen")} error={errors.datum_open?.message}>
          <input
            type="date"
            className="input"
            {...register("datum_open", {
              onChange: (e) => {
                // QoL: keep the close date in sync with the open date, so the close-date
                // calendar opens in the right week and only the day still needs changing.
                // Stops as soon as the user edits the close date themselves (see ResultSection).
                const open = e.target.value;
                if (open && !closeDateTouchedRef.current) {
                  setValue("datum_sluiting", open, { shouldDirty: true, shouldValidate: true });
                }
              },
            })}
          />
        </Field>
        {/* Optional real open time (Fase S2, 0051). Un-gated (UX-D): the session/hour
            breakdowns it feeds are available to everyone, so gating the input that
            fills them was a dead promise. When filled, the DB derives `sessie` from
            it (real time axis) and the trade joins the hour/session breakdowns. */}
        <Field label={t("tradeForm.tijdOpen")} error={errors.tijd_open?.message}>
          <input type="time" className="input" {...register("tijd_open")} />
        </Field>
        {/* Instrument: a forex journal picks from the fixed pair enum (and mirrors it
            into `instrument` on submit); any other journal types its own symbol
            (ticker/coin/contract) and pair stays on its hidden default (cyclus 7). */}
        {isForexJournal ? (
          <Field label={t("tradeForm.pair")} error={errors.pair?.message}>
            <EnumSelect options={PAIRS} {...register("pair")} />
          </Field>
        ) : (
          <>
            <Field label={t("tradeForm.instrument")} error={errors.instrument?.message}>
              <Controller
                name="instrument"
                control={control}
                render={({ field }) => (
                  <InstrumentSelect
                    options={instruments}
                    value={field.value}
                    onChange={field.onChange}
                    onAddInstrument={addInstrument}
                  />
                )}
              />
            </Field>
            <input type="hidden" {...register("pair")} />
          </>
        )}
        {/* Direction is universal core (Long/Short) — shown for every journal. The
            column is nullable, so trades logged before it existed stay null. */}
        <Field label={t("tradeForm.direction")} error={errors.direction?.message}>
          <EnumSelect options={DIRECTIONS} getLabel={(o) => t(`enums.direction.${o}`, o)} {...register("direction")} placeholder={t("tradeForm.directionPlaceholder")} />
        </Field>
      </div>
    </div>
  );
}
