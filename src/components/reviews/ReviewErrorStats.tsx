import { useTranslation } from "react-i18next";
import type { ErrorCounts } from "@/lib/stats";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/** Compact raw-count row for a review: self-flagged errors among taken trades, and what was missed — no synthesized "cost" narrative. */
export function ReviewErrorStats({ emotional, technical, missedCount, missedResultaat }: ErrorCounts) {
  const { t } = useTranslation();
  if (emotional === 0 && technical === 0 && missedCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 font-mono text-xs text-muted">
      {emotional > 0 && <span>{t("reviewErrorStats.emotional", { count: emotional })}</span>}
      {technical > 0 && <span>{t("reviewErrorStats.technical", { count: technical })}</span>}
      {missedCount > 0 && (
        <span>{t("reviewErrorStats.missed", { count: missedCount, pct: signedPct(missedResultaat) })}</span>
      )}
    </div>
  );
}
