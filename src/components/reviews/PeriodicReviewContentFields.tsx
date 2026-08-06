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

const OVERZICHT_LABEL: Partial<Record<PeriodType, string>> = {
  quarter: "Maandoverzicht",
  year: "Kwartaaloverzicht",
};

/**
 * Monthly/quarterly/yearly review editor — same underlying columns as the
 * weekly ReviewContentFields, relabeled to match how periodic reviews are
 * actually written (see reference screenshots): a synthesis per period
 * rather than the weekly technisch/mentaal split. periode_overzicht is
 * skipped for monthly reviews — there's no shorter sub-period to recap.
 */
export function PeriodicReviewContentFields({ periodType, value, onChange }: PeriodicReviewContentFieldsProps) {
  function set<K extends keyof PeriodicReviewContentValue>(key: K, v: PeriodicReviewContentValue[K]) {
    onChange({ ...value, [key]: v });
  }

  const overzichtLabel = OVERZICHT_LABEL[periodType];

  return (
    <>
      <LabeledTextarea label="Genomen trades" rows={3} value={value.technisch} onChange={(v) => set("technisch", v)} />
      <LabeledTextarea label="Genomen trades met errors" rows={3} value={value.mentaal_owner} onChange={(v) => set("mentaal_owner", v)} />
      <LabeledTextarea label="Gemiste trades" rows={3} value={value.mentaal_trader} onChange={(v) => set("mentaal_trader", v)} />

      <StringListField
        label="Werkpunten"
        items={value.acties}
        onChange={(v) => set("acties", v)}
        placeholder="bv. Plan 100% van de keer naast de trade plaatsen"
        addLabel="Werkpunt toevoegen"
      />

      <LabeledTextarea label="Conclusie" rows={3} value={value.takeaway} onChange={(v) => set("takeaway", v)} />

      {overzichtLabel && (
        <LabeledTextarea label={overzichtLabel} rows={4} value={value.periode_overzicht} onChange={(v) => set("periode_overzicht", v)} />
      )}

      <LabeledTextarea label="Overall comment" rows={2} tone="muted" value={value.overall_comment} onChange={(v) => set("overall_comment", v)} />
    </>
  );
}
