import { parseCsv } from "../csv";
import { tableToDeals } from "./table";
import type { ParseResult } from "../types";

/**
 * cTrader "History → Deals" CSV export. cTrader exports are delimited text with
 * a header row, so parsing is: read the CSV, then let the shared column detector
 * map the columns. Column labels differ slightly by cTrader version and broker
 * white-label, which the alias-based detection in table.ts absorbs.
 */
export function parseCtrader(text: string): ParseResult {
  const { headers, rows } = parseCsv(text);
  const { deals, warnings } = tableToDeals(headers, rows);
  return { broker: "ctrader", deals, warnings };
}
