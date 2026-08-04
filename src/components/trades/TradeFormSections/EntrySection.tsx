import { Controller, useFormContext } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { CCS, ENTRIES, FASES, PAIRS, TRADE_CONCEPTS, WEEKLY_CRITERIA, WEEKLY_KENMERKEN } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";

export function EntrySection() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TradeFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">Entry</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Fase" error={errors.fase?.message}>
          <EnumSelect options={FASES} {...register("fase")} />
        </Field>
        <Field label="Datum open" error={errors.datum_open?.message}>
          <input type="date" className="input" {...register("datum_open")} />
        </Field>
        <Field label="Pair" error={errors.pair?.message}>
          <EnumSelect options={PAIRS} {...register("pair")} />
        </Field>
        <Field label="4H Candle Close (CC)" error={errors.cc?.message}>
          <EnumSelect options={CCS} {...register("cc")} />
        </Field>
        <Field label="Trade concept" error={errors.trade_concept?.message}>
          <EnumSelect options={TRADE_CONCEPTS} {...register("trade_concept")} />
        </Field>
        <Field label="Entry" error={errors.entry?.message}>
          <EnumSelect options={ENTRIES} {...register("entry")} />
        </Field>
        <Field label="Weekly criteria" error={errors.weekly_criteria?.message}>
          <EnumSelect options={WEEKLY_CRITERIA} {...register("weekly_criteria")} />
        </Field>
        <Field label="Weekly kenmerk" error={errors.weekly_kenmerk?.message}>
          <EnumSelect options={WEEKLY_KENMERKEN} {...register("weekly_kenmerk")} />
        </Field>
        <Field label="Nieuws nabij trade?">
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
