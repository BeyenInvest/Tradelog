import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-wider text-muted">{label}</label>
      {children}
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
