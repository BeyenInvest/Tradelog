import { useMemo } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { CCS, ENTRIES, PAIRS, TRADE_CONCEPTS, WEEKLY_CRITERIA, WEEKLY_KENMERKEN } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCustomOptions } from "@/hooks/useCustomOptions";
import { useMethodology } from "@/hooks/useMethodology";
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
  const { hideFase } = useAuth();
  const { t } = useTranslation();
  const { faseNames } = useMethodology();
  const { options: customEntries } = useCustomOptions("entry");
  const entryOptions = useMemo(() => [...ENTRIES, ...customEntries.map((o) => o.value)], [customEntries]);
  const { options: customConcepts } = useCustomOptions("trade_concept");
  const conceptOptions = useMemo(
    () => [...TRADE_CONCEPTS, ...customConcepts.map((o) => o.value)],
    [customConcepts]
  );

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionEntry")}</h3>
      <div className="grid grid-cols-2 gap-4">
        {hideFase ? (
          // Still submitted (DB column stays `not null`) — just not editable/visible for a user who doesn't use fasen.
          <input type="hidden" {...register("fase")} />
        ) : (
          <Field label={t("tradeForm.fase")} error={errors.fase?.message}>
            <EnumSelect options={faseNames} {...register("fase")} />
          </Field>
        )}
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
        <Field label={t("tradeForm.pair")} error={errors.pair?.message}>
          <EnumSelect options={PAIRS} {...register("pair")} />
        </Field>
        <Field label={t("tradeForm.cc")} error={errors.cc?.message}>
          <EnumSelect options={CCS} {...register("cc")} />
        </Field>
        <Field label={t("tradeForm.tradeConcept")} error={errors.trade_concept?.message}>
          <EnumSelect options={conceptOptions} {...register("trade_concept")} />
        </Field>
        <Field label={t("tradeForm.entry")} error={errors.entry?.message}>
          <EnumSelect options={entryOptions} {...register("entry")} />
        </Field>
        <Field label={t("tradeForm.weeklyCriteria")} error={errors.weekly_criteria?.message}>
          <EnumSelect options={WEEKLY_CRITERIA} {...register("weekly_criteria")} />
        </Field>
        <Field label={t("tradeForm.weeklyKenmerk")} error={errors.weekly_kenmerk?.message}>
          <EnumSelect options={WEEKLY_KENMERKEN} {...register("weekly_kenmerk")} />
        </Field>
        <Field label={t("tradeForm.newsNearTrade")}>
          <Controller
            name="nieuws"
            control={control}
            render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />}
          />
        </Field>
      </div>
    </div>
  );
}
