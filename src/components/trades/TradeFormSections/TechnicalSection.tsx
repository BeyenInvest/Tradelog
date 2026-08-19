import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { ScreenshotUploadField } from "./ScreenshotUploadField";
import { FaseKenmerkenSection } from "./FaseKenmerkenSection";

export function TechnicalSection() {
  const { t } = useTranslation();
  const { register, control } = useFormContext<TradeFormValues>();
  const { hideFase, betaFeatures } = useAuth();
  const { isLegacyMethodology } = useMethodology();

  // Beta users get paste/upload straight into the private screenshots bucket
  // (Fase K); everyone else keeps the plain URL field until public launch.
  const ScreenshotInput = betaFeatures ? ScreenshotUploadField : UrlPreviewField;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionTechnical")}</h3>
      {/* The multi-timeframe confirms + fase-kenmerken are the Weekly Phase Method's hardcoded
          legacy block. Screenshots + notes below are universal core and always shown. */}
      {isLegacyMethodology && (
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
      )}

      {isLegacyMethodology && !hideFase && <FaseKenmerkenSection />}

      {/* The four screenshot slots are universal, but their timeframe labels
          (Weekly/Daily/4H/2H) are Weekly-Phase-Method jargon. Only the legacy
          journal gets those; every other journal (blank/futures/crypto) sees
          neutral "Screenshot 1-4" so the labels never lie about a timeframe. */}
      <div className="grid grid-cols-2 gap-4">
        <ScreenshotInput name="w_screenshot" label={isLegacyMethodology ? t("tradeForm.weeklyScreenshot") : t("tradeForm.screenshot1")} />
        <ScreenshotInput name="d_screenshot" label={isLegacyMethodology ? t("tradeForm.dailyScreenshot") : t("tradeForm.screenshot2")} />
        <ScreenshotInput name="h4_screenshot" label={isLegacyMethodology ? t("tradeForm.h4Screenshot") : t("tradeForm.screenshot3")} />
        <ScreenshotInput name="h2_screenshot" label={isLegacyMethodology ? t("tradeForm.h2Screenshot") : t("tradeForm.screenshot4")} />
      </div>
      <Field label={t("tradeForm.notes")}>
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
