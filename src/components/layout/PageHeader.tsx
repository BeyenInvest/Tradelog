import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-3xl italic text-ink">{title}</h1>
        {subtitle && <p className="font-mono text-xs mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
