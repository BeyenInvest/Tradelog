import { useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { FASES, PAIRS, OUTCOMES, TRADE_EVALUATIONS, SESSIES } from "@/lib/constants";
import { activeFilterCount, EMPTY_FILTERS, type JournalFilters } from "@/lib/tradeFilters";
import { useAuth } from "@/hooks/useAuth";

interface FilterPanelProps {
  value: JournalFilters;
  onChange: (f: JournalFilters) => void;
}

const NIEUWS_OPTIONS = ["Ja", "Nee"] as const;

/** Extra filter tool next to the PeriodPicker — same popover pattern, scoped to the fields our data model actually has. */
export function FilterPanel({ value, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const count = activeFilterCount(value);
  const { hideFase } = useAuth();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-body transition-colors ${
          count > 0 ? "border-gold text-gold bg-gold/10" : "border-border bg-surface-2 text-ink hover:border-faint"
        }`}
      >
        <SlidersHorizontal size={15} />
        Filters
        {count > 0 && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-gold text-on-gold">{count}</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base italic text-ink">Filters</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
              >
                <X size={12} /> Reset
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!hideFase && (
              <Field label="Fase">
                <EnumSelect
                  options={FASES}
                  value={value.fase ?? ""}
                  onChange={(e) => onChange({ ...value, fase: e.target.value === "" ? undefined : (e.target.value as (typeof FASES)[number]) })}
                  placeholder="Alle fases"
                  className="w-full text-xs py-1.5"
                />
              </Field>
            )}
            <Field label="Pair">
              <EnumSelect
                options={PAIRS}
                value={value.pair ?? ""}
                onChange={(e) => onChange({ ...value, pair: e.target.value === "" ? undefined : (e.target.value as (typeof PAIRS)[number]) })}
                placeholder="Alle pairs"
                className="w-full text-xs py-1.5"
              />
            </Field>
            <Field label="Outcome">
              <EnumSelect
                options={OUTCOMES}
                value={value.outcome ?? ""}
                onChange={(e) => onChange({ ...value, outcome: e.target.value === "" ? undefined : (e.target.value as (typeof OUTCOMES)[number]) })}
                placeholder="Alle outcomes"
                className="w-full text-xs py-1.5"
              />
            </Field>
            <Field label="Sessie">
              <EnumSelect
                options={SESSIES}
                value={value.sessie ?? ""}
                onChange={(e) => onChange({ ...value, sessie: e.target.value === "" ? undefined : (e.target.value as (typeof SESSIES)[number]) })}
                placeholder="Alle sessies"
                className="w-full text-xs py-1.5"
              />
            </Field>
            <Field label="Evaluatie">
              <EnumSelect
                options={TRADE_EVALUATIONS}
                value={value.tradeEvaluation ?? ""}
                onChange={(e) =>
                  onChange({ ...value, tradeEvaluation: e.target.value === "" ? undefined : (e.target.value as (typeof TRADE_EVALUATIONS)[number]) })
                }
                placeholder="Alle"
                className="w-full text-xs py-1.5"
              />
            </Field>
            <Field label="Nieuws">
              <EnumSelect
                options={NIEUWS_OPTIONS}
                value={value.nieuws === undefined ? "" : value.nieuws ? "Ja" : "Nee"}
                onChange={(e) => onChange({ ...value, nieuws: e.target.value === "" ? undefined : e.target.value === "Ja" })}
                placeholder="Alle"
                className="w-full text-xs py-1.5"
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-body text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
