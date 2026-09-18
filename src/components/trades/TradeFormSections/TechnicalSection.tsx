import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { ScreenshotUploadField } from "./ScreenshotUploadField";

export function TechnicalSection() {
  const { t } = useTranslation();
  const { register } = useFormContext<TradeFormValues>();
  const { betaFeatures } = useAuth();

  // Beta users get paste/upload straight into the private screenshots bucket
  // (Fase K); everyone else keeps the plain URL field until public launch.
  const ScreenshotInput = betaFeatures ? ScreenshotUploadField : UrlPreviewField;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionTechnical")}</h3>
      {/* Four neutral screenshot slots for every journal (the former Weekly/Daily/4H
          timeframe labels were Weekly-Phase-Method jargon, retired with the fase
          system in 0059). Notes below are universal core. */}
      <div className="grid grid-cols-2 gap-4">
        <ScreenshotInput name="w_screenshot" label={t("tradeForm.screenshot1")} />
        <ScreenshotInput name="d_screenshot" label={t("tradeForm.screenshot2")} />
        <ScreenshotInput name="h4_screenshot" label={t("tradeForm.screenshot3")} />
        <ScreenshotInput name="h2_screenshot" label={t("tradeForm.screenshot4")} />
      </div>
      <Field label={t("tradeForm.notes")}>
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
