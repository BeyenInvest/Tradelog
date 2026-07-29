import { Controller, useFormContext } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { FaseKenmerkenSection } from "./FaseKenmerkenSection";

export function TechnicalSection() {
  const { register, control } = useFormContext<TradeFormValues>();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">Technical analysis</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Weekly richting mee?">
          <Controller name="w_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Daily richting mee?">
          <Controller name="d_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="4H richting mee?">
          <Controller name="h4_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Extra Daily confirmatie?">
          <Controller name="extra_d_conf" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
      </div>

      <FaseKenmerkenSection />

      <div className="grid grid-cols-2 gap-4">
        <UrlPreviewField name="w_screenshot" label="Weekly screenshot (url)" />
        <UrlPreviewField name="d_screenshot" label="Daily screenshot (url)" />
        <UrlPreviewField name="h4_screenshot" label="4H screenshot (url)" />
        <UrlPreviewField name="h2_screenshot" label="2H screenshot (url)" />
      </div>
      <Field label="Notes">
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
