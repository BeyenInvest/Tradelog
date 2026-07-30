interface BooleanToggleProps {
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  labels?: [string, string];
}

/** Ja/Nee segmented toggle, controlled — wire up via react-hook-form's Controller. */
export function BooleanToggle({ value, onChange, labels = ["Ja", "Nee"] }: BooleanToggleProps) {
  const [yesLabel, noLabel] = labels;
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 text-xs font-body transition-colors ${
          value === true ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 text-xs font-body transition-colors ${
          value === false ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
        }`}
      >
        {noLabel}
      </button>
    </div>
  );
}
