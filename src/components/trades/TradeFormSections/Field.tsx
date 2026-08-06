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
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-loss">{t(error)}</p> : hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}
