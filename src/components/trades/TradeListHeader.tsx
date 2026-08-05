import { useAuth } from "@/hooks/useAuth";

/** Column header row shared by TradeList and review trade groups — 7 columns (6 with fasen hidden), last one reserved for row actions (empty when read-only). */
export function TradeListHeader() {
  const { hideFase } = useAuth();
  return (
    <div className={`grid ${hideFase ? "grid-cols-6" : "grid-cols-7"} gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border`}>
      <span>Datum</span>
      <span>Pair</span>
      {!hideFase && <span>Fase</span>}
      <span>Concept</span>
      <span>Outcome</span>
      <span className="text-right">Resultaat</span>
      <span />
    </div>
  );
}
