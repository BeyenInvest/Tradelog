import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { ScreenshotUploadField } from "./ScreenshotUploadField";
import { CustomFieldGroup, WOVEN_GROUP_KEYS } from "./CustomFieldsSection";

export function TechnicalSection() {
  const { t } = useTranslation();
  const { register } = useFormContext<TradeFormValues>();
  const { betaFeatures } = useAuth();
  const { fields } = useMethodology();

  // Beta users get paste/upload straight into the private screenshots bucket
  // (Fase K); everyone else keeps the plain URL field until public launch.
  const ScreenshotInput = betaFeatures ? ScreenshotUploadField : UrlPreviewField;

  // The four screenshot slots are universal columns, but a WPM journal (has a
  // `fase` field, same signal as the fase-analysis) keeps its Weekly/Daily/4H/Extra
  // timeframe labels; any other journal shows neutral Screenshot 1-4.
  const isWpm = fields.some((f) => f.field_key === "fase");

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionTechnical")}</h3>
      {/* Config fields (setup kenmerken) live here with the screenshots (owner
          2026-09-18). WPM's `cc` is excluded — it sits in the Entry grid instead. */}
      <CustomFieldGroup groupKeys={WOVEN_GROUP_KEYS} excludeKeys={isWpm ? ["cc"] : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <ScreenshotInput name="w_screenshot" label={isWpm ? t("tradeForm.weeklyScreenshot") : t("tradeForm.screenshot1")} />
        <ScreenshotInput name="d_screenshot" label={isWpm ? t("tradeForm.dailyScreenshot") : t("tradeForm.screenshot2")} />
        <ScreenshotInput name="h4_screenshot" label={isWpm ? t("tradeForm.h4Screenshot") : t("tradeForm.screenshot3")} />
        <ScreenshotInput name="h2_screenshot" label={isWpm ? t("tradeForm.h2Screenshot") : t("tradeForm.screenshot4")} />
      </div>
      <Field label={t("tradeForm.notes")}>
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
