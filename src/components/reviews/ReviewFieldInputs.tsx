import { Plus, Trash2 } from "lucide-react";

/**
 * Edit-side counterparts of the read-only primitives in ReviewContentBlocks.
 * The weekly and periodic review editors share the exact same widgets (a
 * labeled textarea, an add/remove string-list) but relabel them — so the markup
 * and list-mutation logic live here once, and each ContentFields component is
 * reduced to just its own labels and field order.
 */

interface LabeledTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function LabeledTextarea({ label, value, onChange, rows = 3 }: LabeledTextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wider text-gold">{label}</label>
      <textarea rows={rows} className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface StringListFieldProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
}

/** The acties/werkpunten editor: a growable list of free-text rows, each removable. */
export function StringListField({ label, items, onChange, placeholder, addLabel }: StringListFieldProps) {
  function update(i: number, v: string) {
    onChange(items.map((a, idx) => (idx === i ? v : a)));
  }
  function add() {
    onChange([...items, ""]);
  }
  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-wider text-gold">{label}</label>
      {items.map((a, i) => (
        <div key={i} className="flex gap-2">
          <input type="text" className="input" placeholder={placeholder} value={a} onChange={(e) => update(i, e.target.value)} />
          <button type="button" onClick={() => remove(i)} className="p-2 rounded-lg text-muted hover:text-loss">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="flex items-center gap-1 text-xs text-muted hover:text-ink w-fit">
        <Plus size={13} /> {addLabel}
      </button>
    </div>
  );
}
