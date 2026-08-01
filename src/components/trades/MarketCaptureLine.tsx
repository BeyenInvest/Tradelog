import type { DisciplineImpact } from "@/lib/stats";
import { computeMarketCapture } from "@/lib/stats";

function signedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

/**
 * Auto-drafts the "Conclusie" a trader otherwise types by hand in every
 * monthly/quarterly review: how much was in the market, how much got banked,
 * how much leaked away to errors + missed setups. Renders nothing when there's
 * no meaningful gap (see computeMarketCapture).
 */
export function MarketCaptureLine({ impact }: { impact: DisciplineImpact }) {
  const cap = computeMarketCapture(impact);
  if (!cap) return null;

  const sharePct = Math.round(cap.capturedShare * 100);
  const barWidth = Math.min(100, Math.max(0, sharePct));

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-body text-xs uppercase tracking-wider text-muted">Marktbenutting</p>
        <p className="font-mono text-sm text-loss">{cap.leftOnTablePct}% laten liggen</p>
      </div>
      <div className="h-2 rounded-full bg-border overflow-hidden mb-2" title={`${sharePct}% benut`}>
        <div className="h-full bg-gold" style={{ width: `${barWidth}%` }} />
      </div>
      <p className="font-body text-xs text-muted">
        Er zat <span className="font-mono text-ink">{cap.availablePct}%</span> in de markt — je pakte{" "}
        <span className="font-mono text-ink">{signedPct(cap.capturedPct)}</span> en liet{" "}
        <span className="font-mono text-loss">{cap.leftOnTablePct}%</span> liggen (errors + gemiste setups).
      </p>
    </div>
  );
}
