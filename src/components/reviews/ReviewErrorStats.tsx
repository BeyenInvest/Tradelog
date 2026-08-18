import { useTranslation } from "react-i18next";
import type { ErrorCounts } from "@/lib/stats";
import { formatAggregate } from "@/lib/format";
import { useResultUnit } from "@/hooks/useResultUnit";

/** Compact raw-count row for a review: self-flagged errors among taken trades, and what was missed — no synthesized "cost" narrative. `missedResultaat` moet al in de actieve eenheid staan (caller: computeErrorCounts over tradesInResultUnit). */
export function ReviewErrorStats({ emotional, technical, missedCount, missedResultaat }: ErrorCounts) {
  const { t } = useTranslation();
  const resultUnit = useResultUnit();
  const signedPct = (n: number) => formatAggregate(n, resultUnit);
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
