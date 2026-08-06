import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarRange, ChevronDown } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { monthRange, quarterRange, yearRange, type DateRange } from "@/lib/periodRanges";

interface PeriodPickerProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekRange(): DateRange {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7; // 0=Mon..6=Sun
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function formatNl(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function sameRange(a: DateRange | null, b: DateRange | null): boolean {
  if (a === null || b === null) return a === b;
  return a.start === b.start && a.end === b.end;
}

const PRESETS: { labelKey: string; range: () => DateRange | null }[] = [
  { labelKey: "period.presetAll", range: () => null },
  { labelKey: "period.thisWeek", range: thisWeekRange },
  {
    labelKey: "period.thisMonth",
    range: () => {
      const n = new Date();
      return monthRange(n.getFullYear(), n.getMonth() + 1);
    },
  },
  {
    labelKey: "period.thisQuarter",
    range: () => {
      const n = new Date();
      return quarterRange(n.getFullYear(), Math.floor(n.getMonth() / 3) + 1);
    },
  },
  { labelKey: "period.thisYear", range: () => yearRange(new Date().getFullYear()) },
];

/** Compact period tool: quick presets + a custom Van/Tot range, scoping the whole Journal view. */
export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  // Decoupled from `value` while editing: clearing one date field (to re-pick it) must not collapse
  // the whole applied range back to "Alle periodes" — only a complete, valid pair commits upward.
  const [customStart, setCustomStart] = useState(value?.start ?? "");
  const [customEnd, setCustomEnd] = useState(value?.end ?? "");

  useEffect(() => {
    setCustomStart(value?.start ?? "");
    setCustomEnd(value?.end ?? "");
  }, [value]);

  function setStart(v: string) {
    setCustomStart(v);
    if (v && customEnd) onChange({ start: v <= customEnd ? v : customEnd, end: v <= customEnd ? customEnd : v });
  }

  function setEnd(v: string) {
    setCustomEnd(v);
    if (v && customStart) onChange({ start: customStart <= v ? customStart : v, end: customStart <= v ? v : customStart });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm font-body text-ink hover:border-faint transition-colors"
      >
        <CalendarRange size={15} className="text-muted" />
        {value ? `${formatNl(value.start)} — ${formatNl(value.end)}` : t("period.all")}
        <ChevronDown size={13} className="text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {PRESETS.map((p) => {
              const r = p.range();
              const active = sameRange(value, r);
              return (
                <button
                  key={p.labelKey}
                  type="button"
                  onClick={() => {
                    onChange(r);
                    setOpen(false);
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-body text-left transition-colors ${
                    active ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  {t(p.labelKey)}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border-soft pt-3">
            <p className="font-body text-[10px] uppercase tracking-wide text-muted mb-2">{t("period.custom")}</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                max={customEnd || isoToday()}
                onChange={(e) => setStart(e.target.value)}
                className="input text-xs py-1.5 flex-1"
              />
              <span className="text-muted text-xs shrink-0">{t("period.to")}</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => setEnd(e.target.value)}
                className="input text-xs py-1.5 flex-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
