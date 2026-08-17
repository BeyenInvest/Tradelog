import type { TradeInput } from "@/lib/types";

/**
 * Supported broker export formats. Extend with new parsers as needed.
 * "generic" is the escape hatch for any flat CSV the alias-based column detector
 * can read (FX Replay and other journal/backtest tools) without naming a parser
 * per tool.
 */
export type ImportBroker = "mt" | "ctrader" | "tradingview" | "generic";

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

/**
 * A non-fatal parse issue, kept structured (kind + count) instead of a prose
 * string so the dialog can render it in the user's language.
 *   - "skippedRows": rows without recognisable trade data (broker summary/junk lines)
 *   - "openTrades": trades without an exit at export time (TradingView) — nothing to import yet
 */
export interface ParseWarning {
  kind: "skippedRows" | "openTrades";
  count: number;
}

export interface ParseResult {
  broker: ImportBroker;
  deals: ParsedDeal[];
  /** Non-fatal issues (skipped junk rows, still-open trades) surfaced in the import preview. */
  warnings: ParseWarning[];
}

/** A trade row ready to insert, carrying the import dedup reference alongside the normal trade payload. */
export type ImportTradeRow = Omit<TradeInput, "backtest_project_id"> & { import_ref: string };
