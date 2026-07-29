import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { FASES, PAIRS } from "@/lib/constants";
import type { Trade } from "@/lib/types";
import { TradeListItem } from "./TradeListItem";

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  title?: string;
  limit?: number;
  /** Rendered next to the title, e.g. the "toon missed trades" toggle. */
  headerAction?: React.ReactNode;
}

export function TradeList({ trades, onEdit, onDelete, title = "Trades", limit, headerAction }: TradeListProps) {
  const [faseFilter, setFaseFilter] = useState("");
  const [pairFilter, setPairFilter] = useState("");

  const filtered = useMemo(() => {
    let result = [...trades].sort((a, b) => b.datum_open.localeCompare(a.datum_open));
    if (faseFilter) result = result.filter((t) => t.fase === faseFilter);
    if (pairFilter) result = result.filter((t) => t.pair === pairFilter);
    if (limit) result = result.slice(0, limit);
    return result;
  }, [trades, faseFilter, pairFilter, limit]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-xl italic text-ink">{title}</h3>
          {headerAction}
        </div>
        {!limit && (
          <div className="flex gap-2">
            <EnumSelect
              options={FASES}
              value={faseFilter}
              onChange={(e) => setFaseFilter(e.target.value)}
              placeholder="Alle fases"
              className="w-36 text-xs py-1.5"
            />
            <EnumSelect
              options={PAIRS}
              value={pairFilter}
              onChange={(e) => setPairFilter(e.target.value)}
              placeholder="Alle pairs"
              className="w-36 text-xs py-1.5"
            />
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex flex-col min-w-[640px]">
          <div className="grid grid-cols-7 gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-2 text-muted border-b border-border">
            <span>Datum</span>
            <span>Pair</span>
            <span>Fase</span>
            <span>Concept</span>
            <span>Outcome</span>
            <span className="text-right">Resultaat</span>
            <span />
          </div>
          {filtered.length === 0 && <p className="text-sm text-muted py-4">Nog geen trades.</p>}
          {filtered.map((t) => (
            <TradeListItem key={t.id} trade={t} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </Card>
  );
}
