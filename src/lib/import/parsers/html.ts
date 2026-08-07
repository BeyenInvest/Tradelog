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

  // The header is the first row that has more than one cell; earlier one-cell
  // rows are the report's title/summary banners.
  const headerIdx = best.findIndex((r) => r.length > 1);
  if (headerIdx === -1) return { headers: best[0] ?? [], rows: [] };
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
