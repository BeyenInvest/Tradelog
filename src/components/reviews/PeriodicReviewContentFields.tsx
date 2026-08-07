import { useTranslation } from "react-i18next";
import type { ReviewContentValue } from "./ReviewContentFields";
import { LabeledTextarea, StringListField } from "./ReviewFieldInputs";
import type { PeriodType } from "@/lib/constants";

export interface PeriodicReviewContentValue extends ReviewContentValue {
  periode_overzicht: string;
}

interface PeriodicReviewContentFieldsProps {
  periodType: PeriodType;
  value: PeriodicReviewContentValue;
  onChange: (value: PeriodicReviewContentValue) => void;
}

const OVERZICHT_LABEL_KEY: Partial<Record<PeriodType, string>> = {
  quarter: "reviewContent.maandoverzicht",
  year: "reviewContent.kwartaaloverzicht",
};

/**
 * Monthly/quarterly/yearly review editor — same underlying columns as the
 * weekly ReviewContentFields, relabeled to match how periodic reviews are
 * actually written (see reference screenshots): a synthesis per period
 * rather than the weekly technisch/mentaal split. periode_overzicht is
 * skipped for monthly reviews — there's no shorter sub-period to recap.
 */
export function PeriodicReviewContentFields({ periodType, value, onChange }: PeriodicReviewContentFieldsProps) {
  const { t } = useTranslation();
  function set<K extends keyof PeriodicReviewContentValue>(key: K, v: PeriodicReviewContentValue[K]) {
    onChange({ ...value, [key]: v });
  }

  const overzichtLabelKey = OVERZICHT_LABEL_KEY[periodType];

  return (
    <>
      <LabeledTextarea label={t("reviewContent.genomenTrades")} rows={3} value={value.technisch} onChange={(v) => set("technisch", v)} />
      <LabeledTextarea label={t("reviewContent.genomenTradesErrors")} rows={3} value={value.mentaal_owner} onChange={(v) => set("mentaal_owner", v)} />
      <LabeledTextarea label={t("reviewContent.gemisteTrades")} rows={3} value={value.mentaal_trader} onChange={(v) => set("mentaal_trader", v)} />

      <StringListField
        label={t("reviewContent.werkpunten")}
        items={value.acties}
        onChange={(v) => set("acties", v)}
        placeholder={t("reviewContent.werkpuntenPlaceholder")}
        addLabel={t("reviewContent.werkpuntenAdd")}
      />

      <LabeledTextarea label={t("reviewContent.conclusie")} rows={3} value={value.takeaway} onChange={(v) => set("takeaway", v)} />

      {overzichtLabelKey && (
        <LabeledTextarea label={t(overzichtLabelKey)} rows={4} value={value.periode_overzicht} onChange={(v) => set("periode_overzicht", v)} />
      )}

      <LabeledTextarea label={t("reviewContent.overallComment")} rows={2} value={value.overall_comment} onChange={(v) => set("overall_comment", v)} />
    </>
  );
}
