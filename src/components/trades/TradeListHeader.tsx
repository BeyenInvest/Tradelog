/** Column header row shared by TradeList and review trade groups — 7 columns, last one reserved for row actions (empty when read-only). */
export function TradeListHeader() {
  return (
    <div className="grid grid-cols-7 gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border">
      <span>Datum</span>
      <span>Pair</span>
      <span>Fase</span>
      <span>Concept</span>
      <span>Outcome</span>
      <span className="text-right">Resultaat</span>
      <span />
    </div>
  );
}
