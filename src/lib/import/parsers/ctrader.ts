import { parseCsv } from "../csv";
import { tableToDeals, locateTable } from "./table";
import type { ParseResult } from "../types";

/**
 * cTrader "History → Deals" CSV export. cTrader exports are delimited text with
 * a header row, so parsing is: read the CSV, locate the real header row (a
 * cTrader *statement* export can prepend account/period banner lines), then let
 * the shared column detector map the columns. Column labels differ slightly by
 * cTrader version and broker white-label, which the alias-based detection in
 * table.ts absorbs — the documented set (Order ID, Symbol, Opening direction,
 * Opening/Closing time, Net (currency), Balance (currency), Commissions, Swap)
 * all resolve, and the running Balance column yields an exact per-trade %.
 */
export function parseCtrader(text: string): ParseResult {
  const { headers, rows } = parseCsv(text);
  const table = locateTable([headers, ...rows]);
  const { deals, warnings } = tableToDeals(table.headers, table.rows);
  return { broker: "ctrader", deals, warnings };
}
