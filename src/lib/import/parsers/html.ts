/**
 * Extracts the largest <table> from a MetaTrader HTML statement as
 * headers + rows, so the shared column detector can read it just like a CSV.
 * MT "Save as Report" / "Detailed Report" produce an HTML document whose deals
 * live in a table; we pick the table with the most data rows (the deals table)
 * and flatten each <tr> into trimmed cell strings.
 *
 * Deliberately regex-based rather than DOM-parsing: this runs in the browser but
 * we avoid depending on DOMParser quirks and keep it unit-testable in node.
 */
export function extractLargestTable(html: string): { headers: string[]; rows: string[][] } {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  let best: string[][] = [];
  for (const table of tables) {
    const rows = tableRows(table);
    if (rows.length > best.length) best = rows;
  }
  if (best.length === 0) return { headers: [], rows: [] };

  // The header is the WIDEST row (most cells). A MetaTrader statement precedes
  // the real column header with narrower banner rows — an Account/Name/Currency
  // line (several colspan cells) and one-cell section titles ("Closed
  // Transactions:") — so "first row with >1 cell" would wrongly pick the banner.
  // First occurrence wins, so the Closed-Transactions header beats the
  // identical-width Open-Trades/Working-Orders headers later in the same table.
  const maxLen = best.reduce((m, r) => Math.max(m, r.length), 0);
  if (maxLen <= 1) return { headers: best[0] ?? [], rows: [] };
  const headerIdx = best.findIndex((r) => r.length === maxLen);
  return { headers: best[headerIdx], rows: best.slice(headerIdx + 1) };
}

function tableRows(table: string): string[][] {
  const trs = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  return trs.map((tr) => {
    const cells = [...tr.matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((m) => cleanCell(m[0]));
    return cells;
  });
}

function cleanCell(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, "") // strip tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
