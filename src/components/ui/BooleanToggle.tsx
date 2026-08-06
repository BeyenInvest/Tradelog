interface BooleanToggleProps {
  value: boolean | null | undefined;
  onChange: (value: boolean) => void;
  labels?: [string, string];
}

/** Ja/Nee segmented toggle, controlled — wire up via react-hook-form's Controller. */
export function BooleanToggle({ value, onChange, labels = ["Ja", "Nee"] }: BooleanToggleProps) {
  const [yesLabel, noLabel] = labels;
  return (
    // shrink-0: `overflow-hidden` on a flex item drops its automatic min-width to 0, so without this
    // a cramped flex row (see SettingsPage) can squeeze this below its own content width and silently
    // clip the second button instead of wrapping the sibling text like it's supposed to.
    <div className="inline-flex shrink-0 rounded-lg border border-border divide-x divide-border overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value === true}
        className={`px-3 py-1.5 text-xs font-body transition-colors ${
          value === true ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
        }`}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={value === false}
        className={`px-3 py-1.5 text-xs font-body transition-colors ${
          value === false ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
        }`}
      >
        {noLabel}
      </button>
    </div>
  );
}
