/**
 * Raw data export (trader-vertrouwen: "jouw data blijft van jou").
 *
 * Turns DB rows into a CSV string verbatim — every column, no reshaping — so
 * the export is a faithful copy of what the user owns rather than a curated
 * report. Object/array values (e.g. trades.custom) are serialized as JSON in
 * their cell; the file opens in Excel/Sheets and round-trips through any
 * script.
 */

/** Union of keys across rows, in first-seen order, so a column that only some
 * rows carry (rare, but e.g. after a schema addition) is never dropped. */
export function csvColumns(rows: Record<string, unknown>[]): string[] {
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        cols.push(key);
      }
    }
  }
  return cols;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Quote when the cell contains a delimiter, quote or newline; double inner quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows → CSV text (header + data lines, CRLF per RFC 4180). */
export function rowsToCsv(rows: Record<string, unknown>[]): string {
  const cols = csvColumns(rows);
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\r\n");
}

/** Trigger a client-side download of CSV text (UTF-8 BOM so Excel reads accents). */
const BOM = "﻿";
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
