import { Plus, Trash2 } from "lucide-react";

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

/** Technisch/Mentaal/Acties/Takeaway/Overall-comment editor, shared by the weekly review form and the monthly/quarterly/yearly review form. */
export function ReviewContentFields({ value, onChange }: ReviewContentFieldsProps) {
  function set<K extends keyof ReviewContentValue>(key: K, v: ReviewContentValue[K]) {
    onChange({ ...value, [key]: v });
  }
  function updateActie(i: number, v: string) {
    set(
      "acties",
      value.acties.map((a, idx) => (idx === i ? v : a))
    );
  }
  function addActie() {
    set("acties", [...value.acties, ""]);
  }
  function removeActie(i: number) {
    set(
      "acties",
      value.acties.filter((_, idx) => idx !== i)
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Technisch</label>
        <textarea rows={3} className="input" value={value.technisch} onChange={(e) => set("technisch", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-gold">Mentaal — Owner</label>
          <textarea rows={4} className="input" value={value.mentaal_owner} onChange={(e) => set("mentaal_owner", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-gold">Mentaal — Trader</label>
          <textarea rows={4} className="input" value={value.mentaal_trader} onChange={(e) => set("mentaal_trader", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wider text-gold">Acties</label>
        {value.acties.map((a, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              className="input"
              placeholder="bv. Backtesting: ok"
              value={a}
              onChange={(e) => updateActie(i, e.target.value)}
            />
            <button type="button" onClick={() => removeActie(i)} className="p-2 rounded-lg text-muted hover:text-loss">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addActie} className="flex items-center gap-1 text-xs text-muted hover:text-ink w-fit">
          <Plus size={13} /> Actie toevoegen
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-gold">Wat neem ik mee?</label>
        <textarea rows={2} className="input" value={value.takeaway} onChange={(e) => set("takeaway", e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted">Overall comment</label>
        <textarea rows={2} className="input" value={value.overall_comment} onChange={(e) => set("overall_comment", e.target.value)} />
      </div>
    </>
  );
}
