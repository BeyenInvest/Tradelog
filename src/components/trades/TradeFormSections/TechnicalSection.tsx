import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { Field } from "./Field";
import { UrlPreviewField } from "./UrlPreviewField";
import { ScreenshotUploadField } from "./ScreenshotUploadField";
import { CustomFieldGroup, SingleCustomField, WOVEN_GROUP_KEYS } from "./CustomFieldsSection";
import { blockGroupLabel } from "@/lib/fieldBlocks";
import { dynamicMethodologyFields } from "@/lib/methodologyFields";

export function TechnicalSection() {
  const { t } = useTranslation();
  const { register } = useFormContext<TradeFormValues>();
  const { betaFeatures } = useAuth();
  const { fields, screenshotLabels } = useMethodology();

  // Beta users get paste/upload straight into the private screenshots bucket
  // (Fase K); everyone else keeps the plain URL field until public launch.
  const ScreenshotInput = betaFeatures ? ScreenshotUploadField : UrlPreviewField;

  // The four screenshot slots are universal columns, but a WPM journal (has a
  // `fase` field, same signal as the fase-analysis) keeps its Weekly/Daily/4H/Extra
  // timeframe labels; any other journal shows neutral Screenshot 1-4.
  const isWpm = fields.some((f) => f.field_key === "fase");

  // WPM renders its config fields as one flat "Setup & uitvoering" block in the
  // journal's OWN order (sort_order), so reordering/dragging them in Settings moves
  // them here too — WYSIWYG (owner 2026-09-22, replacing the hard-coded
  // WPM_TECH_FIELD_ORDER). `cc` is excluded — it lives in the Entry grid.
  const wovenKeys: readonly string[] = WOVEN_GROUP_KEYS;
  const wovenConfig = dynamicMethodologyFields(fields).filter(
    (f) => wovenKeys.includes(f.group_key ?? "") && f.field_key !== "cc"
  );

  // Per-slot screenshot names: the journal's own label (0060) if set, else the
  // built-in default (WPM timeframe names, or neutral Screenshot 1-4).
  const defaultScreenshotLabels = isWpm
    ? [t("tradeForm.weeklyScreenshot"), t("tradeForm.dailyScreenshot"), t("tradeForm.h4Screenshot"), t("tradeForm.h2Screenshot")]
    : [t("tradeForm.screenshot1"), t("tradeForm.screenshot2"), t("tradeForm.screenshot3"), t("tradeForm.screenshot4")];
  const slotLabel = (i: number) => screenshotLabels?.[i]?.trim() || defaultScreenshotLabels[i];

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionTechnical")}</h3>
      {/* Config fields (setup kenmerken) live here with the screenshots (owner
          2026-09-18). WPM shows one flat block ordered by the journal's own field
          order; other journals fall back to the generic per-group rendering. `cc` is
          excluded either way — it sits in the Entry grid instead. */}
      {isWpm ? (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{blockGroupLabel(t, "setup")}</p>
          <div className="grid grid-cols-2 gap-4">
            {wovenConfig.map((f) => (
              <SingleCustomField key={f.field_key} fieldKey={f.field_key} />
            ))}
          </div>
        </div>
      ) : (
        <CustomFieldGroup groupKeys={WOVEN_GROUP_KEYS} />
      )}
      <div className="grid grid-cols-2 gap-4">
        <ScreenshotInput name="w_screenshot" label={slotLabel(0)} />
        <ScreenshotInput name="d_screenshot" label={slotLabel(1)} />
        <ScreenshotInput name="h4_screenshot" label={slotLabel(2)} />
        <ScreenshotInput name="h2_screenshot" label={slotLabel(3)} />
      </div>
      <Field label={t("tradeForm.notes")}>
        <textarea rows={3} className="input" {...register("notes")} />
      </Field>
    </div>
  );
}
