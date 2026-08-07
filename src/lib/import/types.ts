import type { TradeInput } from "@/lib/types";

/** Supported broker export formats. Extend with new parsers as needed. */
export type ImportBroker = "mt" | "ctrader";

/**
 * Broker-neutral representation of one closed deal, extracted by a parser before
 * any mapping to the app's trade model. Every field a parser can't find is null;
 * mapToTrade decides how to fill or flag the gaps. `raw` keeps the original row
 * for the preview table and debugging against unfamiliar export variants.
 */
export interface ParsedDeal {
  /** Broker deal/order id — the dedup key. Combined with the broker into import_ref. */
  ticket: string;
  /** Raw broker symbol, e.g. "EURUSD", "GBPUSD.r", "XAUUSD.pro". */
  symbol: string;
  direction: "buy" | "sell" | null;
  /** ISO-ish open/close timestamps as they appeared, best-effort normalised to `yyyy-mm-dd` downstream. */
  openTime: string | null;
  closeTime: string | null;
  /** Net account impact of the deal in account currency (profit incl. swap/commission where derivable). */
  pnlAmount: number | null;
  /** Broker-provided return %, if the export carried one directly. */
  returnPct: number | null;
  /** Running account balance AFTER this deal, if the export carried a balance column — used to derive an exact per-trade %. */
  balanceAfter: number | null;
  raw: Record<string, string>;
}

export interface ParseResult {
  broker: ImportBroker;
  deals: ParsedDeal[];
  /** Non-fatal issues (skipped junk rows, missing optional columns) surfaced in the import preview. */
  warnings: string[];
}

/** A trade row ready to insert, carrying the import dedup reference alongside the normal trade payload. */
export type ImportTradeRow = Omit<TradeInput, "backtest_project_id"> & { import_ref: string };
