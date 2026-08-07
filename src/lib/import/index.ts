import { parseMt } from "./parsers/mt";
import { parseCtrader } from "./parsers/ctrader";
import type { ImportBroker, ParseResult } from "./types";

export type { ImportBroker, ParsedDeal, ParseResult, ImportTradeRow } from "./types";
export { prepareImport, type PreparedImport, type PrepareOptions } from "./prepare";
export { normalizeSymbol } from "./symbols";

/** Best-effort broker guess from file contents/name; the user can override it in the import dialog. */
export function detectBroker(text: string, filename: string): ImportBroker {
  const name = filename.toLowerCase();
  if (/<table[\s>]|<html[\s>]/i.test(text)) return "mt"; // HTML statement = MetaTrader
  if (name.includes("ctrader")) return "ctrader";
  if (name.includes("mt4") || name.includes("mt5") || name.includes("metatrader")) return "mt";
  return "ctrader"; // plain CSV default
}

export function parseFile(text: string, broker: ImportBroker): ParseResult {
  return broker === "mt" ? parseMt(text) : parseCtrader(text);
}
