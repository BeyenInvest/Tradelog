import type { ErrorCounts } from "@/lib/stats";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/** Compact raw-count row for a review: self-flagged errors among taken trades, and what was missed — no synthesized "cost" narrative. */
export function ReviewErrorStats({ emotional, technical, missedCount, missedResultaat }: ErrorCounts) {
  if (emotional === 0 && technical === 0 && missedCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-4 font-mono text-xs text-muted">
      {emotional > 0 && <span>{emotional} emotional error{emotional === 1 ? "" : "s"}</span>}
      {technical > 0 && <span>{technical} technical error{technical === 1 ? "" : "s"}</span>}
      {missedCount > 0 && (
        <span>
          {missedCount} missed trade{missedCount === 1 ? "" : "s"} ({signedPct(missedResultaat)})
        </span>
      )}
    </div>
  );
}
