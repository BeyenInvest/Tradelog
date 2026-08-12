import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, X } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { PAIRS, DIRECTIONS, OUTCOMES, TRADE_EVALUATIONS, SESSIES } from "@/lib/constants";
import { activeFilterCount, EMPTY_FILTERS, type JournalFilters } from "@/lib/tradeFilters";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";

interface FilterPanelProps {
  value: JournalFilters;
  onChange: (f: JournalFilters) => void;
}

const NIEUWS_OPTIONS = ["Ja", "Nee"] as const;

/** Extra filter tool next to the PeriodPicker — same popover pattern, scoped to the fields our data model actually has. */
export function FilterPanel({ value, onChange }: FilterPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const count = activeFilterCount(value);
  const { hideFase, betaFeatures } = useAuth();
  const { faseNames, isLegacyMethodology, isForexJournal } = useMethodology();

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
        {t("filters.title")}
        {count > 0 && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-gold text-on-gold">{count}</span>}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-80 rounded-xl border border-border bg-surface p-4 shadow-lg max-md:fixed max-md:inset-x-3 max-md:w-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="font-display text-base italic text-ink">{t("filters.title")}</p>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors"
              >
                <X size={12} /> {t("common.reset")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* fase filter: legacy WPM only + still per-user hideable (matches the form/analysis). */}
            {isLegacyMethodology && !hideFase && (
              <Field label={t("filters.fase")}>
                <EnumSelect
                  options={faseNames}
                  value={value.fase ?? ""}
                  onChange={(e) => onChange({ ...value, fase: e.target.value === "" ? undefined : e.target.value })}
                  placeholder={t("filters.allFases")}
                  className="w-full text-xs py-1.5"
                />
              </Field>
            )}
            {/* Instrument: forex journal filters by the pair enum; any other journal by a free
                instrument substring (cyclus 7). */}
            {isForexJournal ? (
              <Field label={t("filters.pair")}>
                <EnumSelect
                  options={PAIRS}
                  value={value.pair ?? ""}
                  onChange={(e) => onChange({ ...value, pair: e.target.value === "" ? undefined : (e.target.value as (typeof PAIRS)[number]) })}
                  placeholder={t("filters.allPairs")}
                  className="w-full text-xs py-1.5"
                />
              </Field>
            ) : (
              <Field label={t("tradeForm.instrument")}>
                <input
                  type="text"
                  value={value.instrument ?? ""}
                  onChange={(e) => onChange({ ...value, instrument: e.target.value === "" ? undefined : e.target.value })}
                  placeholder={t("filters.allInstruments")}
                  className="input w-full text-xs py-1.5"
                />
              </Field>
            )}
            {/* Soft-launch: direction ships with the beta multi-journal UI (0033). */}
            {betaFeatures && (
              <Field label={t("filters.direction")}>
                <EnumSelect
                  options={DIRECTIONS}
                  value={value.direction ?? ""}
                  onChange={(e) => onChange({ ...value, direction: e.target.value === "" ? undefined : (e.target.value as (typeof DIRECTIONS)[number]) })}
                  placeholder={t("filters.allDirections")}
                  className="w-full text-xs py-1.5"
                />
              </Field>
            )}
            <Field label={t("filters.outcome")}>
              <EnumSelect
                options={OUTCOMES}
                value={value.outcome ?? ""}
                onChange={(e) => onChange({ ...value, outcome: e.target.value === "" ? undefined : (e.target.value as (typeof OUTCOMES)[number]) })}
                placeholder={t("filters.allOutcomes")}
                className="w-full text-xs py-1.5"
              />
            </Field>
            {/* sessie is derived from cc, a legacy WPM field — only meaningful on a legacy journal. */}
            {isLegacyMethodology && (
              <Field label={t("filters.sessie")}>
                <EnumSelect
                  options={SESSIES}
                  value={value.sessie ?? ""}
                  onChange={(e) => onChange({ ...value, sessie: e.target.value === "" ? undefined : (e.target.value as (typeof SESSIES)[number]) })}
                  placeholder={t("filters.allSessions")}
                  className="w-full text-xs py-1.5"
                />
              </Field>
            )}
            <Field label={t("filters.evaluation")}>
              <EnumSelect
                options={TRADE_EVALUATIONS}
                value={value.tradeEvaluation ?? ""}
                onChange={(e) =>
                  onChange({ ...value, tradeEvaluation: e.target.value === "" ? undefined : (e.target.value as (typeof TRADE_EVALUATIONS)[number]) })
                }
                placeholder={t("filters.all")}
                className="w-full text-xs py-1.5"
              />
            </Field>
            {/* news (nieuws) is a legacy WPM field — gated out of the form for non-legacy journals too. */}
            {isLegacyMethodology && (
              <Field label={t("filters.news")}>
                <EnumSelect
                  options={NIEUWS_OPTIONS}
                  value={value.nieuws === undefined ? "" : value.nieuws ? "Ja" : "Nee"}
                  onChange={(e) => onChange({ ...value, nieuws: e.target.value === "" ? undefined : e.target.value === "Ja" })}
                  placeholder={t("filters.all")}
                  className="w-full text-xs py-1.5"
                />
              </Field>
            )}
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
