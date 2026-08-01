import type { DisciplineImpact } from "@/lib/stats";
import { computeMarketCapture, round2 } from "@/lib/stats";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/**
 * Auto-drafts the "Conclusie" a trader otherwise types by hand: how much
 * leaked away to errors + missed setups, and — when there was a positive pool
 * to capture — how much of the market got banked vs left. Renders nothing when
 * there's no real cost (no errors/skips, or they netted to a help).
 *
 * The "er zat X% in de markt" framing only shows when that pool is positive
 * (computeMarketCapture returns non-null); a losing period still shows the
 * left-on-the-table breakdown, so the block never silently disappears just
 * because the period was red.
 */
export function MarketCaptureLine({ impact }: { impact: DisciplineImpact }) {
  if (impact.errorCount === 0 && impact.missedCount === 0) return null;
  const leftOnTablePct = round2(impact.errorCostPct + impact.missedResultPct);
  if (leftOnTablePct <= 0) return null;

  const cap = computeMarketCapture(impact);
  const sharePct = cap ? Math.round(cap.capturedShare * 100) : 0;
  const barWidth = Math.min(100, Math.max(0, sharePct));

  const breakdown = [
    impact.errorCount > 0 ? `errors ${signedPct(impact.errorResultPct)}` : null,
    impact.missedCount > 0 ? `gemiste setups ${signedPct(impact.missedResultPct)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-body text-xs uppercase tracking-wider text-muted">Marktbenutting</p>
        <p className="font-mono text-sm text-loss">{leftOnTablePct}% laten liggen</p>
      </div>

      {cap && (
        <div className="h-2 rounded-full bg-border overflow-hidden mb-2" title={`${sharePct}% benut`}>
          <div className="h-full bg-gold" style={{ width: `${barWidth}%` }} />
        </div>
      )}

      <p className="font-body text-xs text-muted">
        {cap ? (
          <>
            Er zat <span className="font-mono text-ink">{cap.availablePct}%</span> in de markt — je pakte{" "}
            <span className="font-mono text-ink">{signedPct(cap.capturedPct)}</span> en liet{" "}
            <span className="font-mono text-loss">{leftOnTablePct}%</span> liggen.
          </>
        ) : (
          <>
            Je liet <span className="font-mono text-loss">{leftOnTablePct}%</span> liggen door errors + gemiste setups.
          </>
        )}
      </p>
      {breakdown && <p className="font-body text-[11px] text-faint mt-1">{breakdown}</p>}
    </div>
  );
}
