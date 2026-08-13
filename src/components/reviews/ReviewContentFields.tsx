import { useTranslation } from "react-i18next";
import { LabeledTextarea, StringListField } from "./ReviewFieldInputs";

export interface ReviewContentValue {
  verhalen: string;
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
      <LabeledTextarea label={t("reviewContent.verhalen")} hint={t("reviewContent.verhalenHint")} rows={3} value={value.verhalen} onChange={(v) => set("verhalen", v)} />

      <LabeledTextarea label={t("reviewContent.technisch")} rows={3} value={value.technisch} onChange={(v) => set("technisch", v)} />

      {/* Single mental field (Fase F). Writes to mentaal_owner; mentaal_trader is a legacy
          column no longer edited here but preserved on save and still shown in the detail view. */}
      <LabeledTextarea label={t("reviewContent.mentaal")} rows={4} value={value.mentaal_owner} onChange={(v) => set("mentaal_owner", v)} />

      <StringListField
        label={t("reviewContent.acties")}
        items={value.acties}
        onChange={(v) => set("acties", v)}
        placeholder={t("reviewContent.actiesPlaceholder")}
        addLabel={t("reviewContent.actiesAdd")}
      />

      <LabeledTextarea label={t("reviewContent.takeaway")} rows={2} value={value.takeaway} onChange={(v) => set("takeaway", v)} />
      <LabeledTextarea label={t("reviewContent.overallComment")} rows={2} value={value.overall_comment} onChange={(v) => set("overall_comment", v)} />
    </>
  );
}
