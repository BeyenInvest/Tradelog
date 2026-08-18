import { parseCsv } from "../csv";
import { tableToDeals, locateTable } from "./table";
import { extractLargestTable } from "./html";
import type { ParseResult } from "../types";

/** True when the text looks like a MetaTrader HTML statement rather than a CSV. */
function isHtml(text: string): boolean {
  return /<table[\s>]/i.test(text) || /<html[\s>]/i.test(text);
}

/**
 * MetaTrader 4/5 history export. Accepts either the HTML statement
 * ("Save as Report" / "Detailed Report") or a CSV history export — the deals
 * table is extracted the same way in both cases and handed to the shared column
 * detector. MT stores server-time timestamps; only the date is kept (see
 * parseDateOnly), so the broker-server-vs-local/DST offset is a known caveat to
 * revisit against a real export.
 */
export function parseMt(text: string): ParseResult {
  let headers: string[];
  let rows: string[][];
  if (isHtml(text)) {
    ({ headers, rows } = extractLargestTable(text)); // HTML picks the widest row as header
  } else {
    const csv = parseCsv(text);
    ({ headers, rows } = locateTable([csv.headers, ...csv.rows])); // CSV export may lead with banner rows
  }
  const { deals, warnings } = tableToDeals(headers, rows);
  return { broker: "mt", deals, warnings };
}
