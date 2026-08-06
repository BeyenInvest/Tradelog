import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { FaseKenmerkenSection } from "./FaseKenmerkenSection";

export function TechnicalSection() {
  const { t } = useTranslation();
  const { register, control } = useFormContext<TradeFormValues>();
  const { hideFase } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionTechnical")}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("tradeForm.weeklyDirection")}>
          <Controller name="w_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label={t("tradeForm.dailyDirection")}>
          <Controller name="d_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label={t("tradeForm.h4Direction")}>
          <Controller name="h4_confirm" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label={t("tradeForm.extraDailyConfirm")}>
          <Controller name="extra_d_conf" control={control} render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />} />
        </Field>
      </div>

      {!hideFase && <FaseKenmerkenSection />}

      <div className="grid grid-cols-2 gap-4">
        <UrlPreviewField name="w_screenshot" label={t("tradeForm.weeklyScreenshot")} />
        <UrlPreviewField name="d_screenshot" label={t("tradeForm.dailyScreenshot")} />
        <UrlPreviewField name="h4_screenshot" label={t("tradeForm.h4Screenshot")} />
        <UrlPreviewField name="h2_screenshot" label={t("tradeForm.h2Screenshot")} />
      </div>
      <Field label={t("tradeForm.notes")}>
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
