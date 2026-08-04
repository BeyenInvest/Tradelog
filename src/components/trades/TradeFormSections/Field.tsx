import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string;
  /** Marks the label with a "*" so a required field is obvious before submit, not just after a failed one. */
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, error, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wider text-muted">
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
