import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface FieldProps {
  label: string;
  /** i18n key for a validation message (from tradeSchema in validation.ts) — resolved here. */
  error?: string;
  /** Marks the label with a "*" so a required field is obvious before submit, not just after a failed one. */
  required?: boolean;
  /** Optional already-translated helper text shown under the input (hidden while an error is showing). */
  hint?: string;
  children: ReactNode;
}

export function Field({ label, error, required, hint, children }: FieldProps) {
  const { t } = useTranslation();
  return (
    // Wrapping <label> implicitly associates the caption with the nested control, so screenreaders
    // announce it and clicking the caption focuses the input — no per-child id/htmlFor plumbing needed
    // (the caption is a <span>, since <label> carried the styling before). Button-group children
    // (BooleanToggle) aren't labelable, so they simply gain nothing here rather than regressing.
    <label className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-gold"> *</span>}
      </span>
      {children}
      {/* Helper text under an input is informative, so it uses `text-muted` (not `text-faint`) to keep AA contrast (E6). */}
      {error ? <p className="text-xs text-loss">{t(error)}</p> : hint && <p className="text-xs text-muted">{hint}</p>}
    </label>
  );
}
