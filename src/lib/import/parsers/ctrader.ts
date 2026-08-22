import { parseFlatCsv } from "./table";
import type { DateOrder } from "../values";
import type { ParseResult } from "../types";

/**
 * cTrader "History → Deals" CSV export. cTrader exports are delimited text with
 * a header row, so parsing is the shared flat-CSV pipeline: read the CSV, locate
 * the real header row (a cTrader *statement* export can prepend account/period
 * banner lines), then let the shared column detector map the columns. Column
 * labels differ slightly by cTrader version and broker white-label, which the
 * alias-based detection in table.ts absorbs — the documented set (Order ID,
 * Symbol, Opening direction, Opening/Closing time, Net (currency), Balance
 * (currency), Commissions, Swap) all resolve, and the running Balance column
 * yields an exact per-trade %.
 */
export function parseCtrader(text: string, dateOrder: DateOrder = "dmy"): ParseResult {
  return parseFlatCsv(text, "ctrader", dateOrder);
}
