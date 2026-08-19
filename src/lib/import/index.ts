import { parseMt } from "./parsers/mt";
import { parseCtrader } from "./parsers/ctrader";
import { parseTradingview } from "./parsers/tradingview";
import { parseFlatCsv } from "./parsers/table";
import type { ImportBroker, ParseResult } from "./types";

export type { ImportBroker, ParsedDeal, ParseResult, ParseWarning, ImportTradeRow } from "./types";
export { prepareImport, type PreparedImport, type PrepareOptions } from "./prepare";
export { normalizeSymbol } from "./symbols";
export { applyFileSymbol } from "./parsers/tradingview";

/** Best-effort broker guess from file contents/name; the user can override it in the import dialog. */
export function detectBroker(text: string, filename: string): ImportBroker {
  const name = filename.toLowerCase();
  if (/<table[\s>]|<html[\s>]/i.test(text)) return "mt"; // HTML statement = MetaTrader
  // Strategy Tester "List of Trades" — its Trade-#/Type/Date-Time header trio is
  // unmistakable, so content beats filename here.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== "")?.toLowerCase() ?? "";
  if (firstLine.includes("trade #") && firstLine.includes("type") && firstLine.includes("date")) return "tradingview";
  if (name.includes("tradingview") || name.includes("papertrading")) return "tradingview";
  if (name.includes("fxreplay") || name.includes("fx-replay") || name.includes("fx_replay")) return "generic";
  if (name.includes("ctrader")) return "ctrader";
  if (name.includes("mt4") || name.includes("mt5") || name.includes("metatrader")) return "mt";
  return "ctrader"; // plain CSV default
}

export function parseFile(text: string, broker: ImportBroker): ParseResult {
  switch (broker) {
    case "mt":
      return parseMt(text);
    case "tradingview":
      return parseTradingview(text);
    case "generic":
      // Flat CSV through the shared column detector — no broker-specific handling at all.
      return parseFlatCsv(text, "generic");
    case "ctrader":
      return parseCtrader(text);
  }
}
