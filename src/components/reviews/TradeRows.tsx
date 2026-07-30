import clsx from "clsx";
import type { Trade } from "@/lib/types";
import { OutcomePill } from "@/components/ui/OutcomePill";

interface TradeRowsProps {
  label: string;
  rows: Trade[];
  emptyLabel: string;
  muted?: boolean;
}

/** A labeled, counted list of trade summary rows — used for both "genomen" and "missed" trade groups. */
export function TradeRows({ label, rows, emptyLabel, muted }: TradeRowsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-body text-[11px] uppercase tracking-wide text-faint">
        {label} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{emptyLabel}</p>
      ) : (
        rows.map((t) => (
          <div
            key={t.id}
            className={`grid grid-cols-[72px_1fr_64px_64px] items-center gap-2 font-mono text-xs py-1.5 border-b border-border-soft ${muted ? "opacity-60" : ""}`}
          >
            <span className="text-muted">{t.datum_open}</span>
            <span className="text-ink">{t.pair}</span>
            <OutcomePill outcome={t.outcome} />
            <span
              className={clsx("text-right", t.resultaat_pct > 0 ? "text-win" : t.resultaat_pct < 0 ? "text-loss" : "text-be")}
            >
              {t.resultaat_pct > 0 ? "+" : ""}
              {t.resultaat_pct}%
            </span>
          </div>
        ))
      )}
    </div>
  );
}
