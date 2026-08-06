import { useTranslation } from "react-i18next";
import { LabeledTextarea, StringListField } from "./ReviewFieldInputs";

export interface ReviewContentValue {
  technisch: string;
  mentaal_owner: string;
  mentaal_trader: string;
  acties: string[];
  takeaway: string;
  overall_comment: string;
}

interface ReviewContentFieldsProps {
  value: ReviewContentValue;
  onChange: (value: ReviewContentValue) => void;
}

/** Technisch/Mentaal/Acties/Takeaway/Overall-comment editor for the weekly review form. */
export function ReviewContentFields({ value, onChange }: ReviewContentFieldsProps) {
  const { t } = useTranslation();
  function set<K extends keyof ReviewContentValue>(key: K, v: ReviewContentValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <>
      <LabeledTextarea label={t("reviewContent.technisch")} rows={3} value={value.technisch} onChange={(v) => set("technisch", v)} />

      <div className="grid grid-cols-2 gap-4">
        <LabeledTextarea label={t("reviewContent.mentaalOwner")} rows={4} value={value.mentaal_owner} onChange={(v) => set("mentaal_owner", v)} />
        <LabeledTextarea label={t("reviewContent.mentaalTrader")} rows={4} value={value.mentaal_trader} onChange={(v) => set("mentaal_trader", v)} />
      </div>

      <StringListField
        label={t("reviewContent.acties")}
        items={value.acties}
        onChange={(v) => set("acties", v)}
        placeholder={t("reviewContent.actiesPlaceholder")}
        addLabel={t("reviewContent.actiesAdd")}
      />

      <LabeledTextarea label={t("reviewContent.takeaway")} rows={2} value={value.takeaway} onChange={(v) => set("takeaway", v)} />
      <LabeledTextarea label={t("reviewContent.overallComment")} rows={2} tone="muted" value={value.overall_comment} onChange={(v) => set("overall_comment", v)} />
    </>
  );
}
