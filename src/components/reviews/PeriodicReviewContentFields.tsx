import { Plus, Trash2 } from "lucide-react";
import type { ReviewContentValue } from "./ReviewContentFields";
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
  function updateWerkpunt(i: number, v: string) {
    set(
      "acties",
      value.acties.map((a, idx) => (idx === i ? v : a))
    );
  }
  function addWerkpunt() {
    set("acties", [...value.acties, ""]);
  }
  function removeWerkpunt(i: number) {
    set(
      "acties",
      value.acties.filter((_, idx) => idx !== i)
    );
  }

  const overzichtLabel = OVERZICHT_LABEL[periodType];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Genomen trades</label>
        <textarea rows={3} className="input" value={value.technisch} onChange={(e) => set("technisch", e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Genomen trades met errors</label>
        <textarea rows={3} className="input" value={value.mentaal_owner} onChange={(e) => set("mentaal_owner", e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Gemiste trades</label>
        <textarea rows={3} className="input" value={value.mentaal_trader} onChange={(e) => set("mentaal_trader", e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wider text-gold">Werkpunten</label>
        {value.acties.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              className="input"
              placeholder="bv. Plan 100% van de keer naast de trade plaatsen"
              value={a}
              onChange={(e) => updateWerkpunt(i, e.target.value)}
            />
            <button type="button" onClick={() => removeWerkpunt(i)} className="p-2 rounded-lg text-muted hover:text-loss">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addWerkpunt} className="flex items-center gap-1 text-xs text-muted hover:text-ink w-fit">
          <Plus size={13} /> Werkpunt toevoegen
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Conclusie</label>
        <textarea rows={3} className="input" value={value.takeaway} onChange={(e) => set("takeaway", e.target.value)} />
      </div>

      {overzichtLabel && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-gold">{overzichtLabel}</label>
          <textarea
            rows={4}
            className="input"
            value={value.periode_overzicht}
            onChange={(e) => set("periode_overzicht", e.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted">Overall comment</label>
        <textarea rows={2} className="input" value={value.overall_comment} onChange={(e) => set("overall_comment", e.target.value)} />
      </div>
    </>
  );
}
