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
  function set<K extends keyof ReviewContentValue>(key: K, v: ReviewContentValue[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <>
      <LabeledTextarea label="Technisch" rows={3} value={value.technisch} onChange={(v) => set("technisch", v)} />

      <div className="grid grid-cols-2 gap-4">
        <LabeledTextarea label="Mentaal — Owner" rows={4} value={value.mentaal_owner} onChange={(v) => set("mentaal_owner", v)} />
        <LabeledTextarea label="Mentaal — Trader" rows={4} value={value.mentaal_trader} onChange={(v) => set("mentaal_trader", v)} />
      </div>

      <StringListField
        label="Acties"
        items={value.acties}
        onChange={(v) => set("acties", v)}
        placeholder="bv. Backtesting: ok"
        addLabel="Actie toevoegen"
      />

      <LabeledTextarea label="Wat neem ik mee?" rows={2} value={value.takeaway} onChange={(v) => set("takeaway", v)} />
      <LabeledTextarea label="Overall comment" rows={2} tone="muted" value={value.overall_comment} onChange={(v) => set("overall_comment", v)} />
    </>
  );
}
