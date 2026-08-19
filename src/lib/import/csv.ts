/**
 * Minimal, dependency-free CSV/DSV reader. Broker exports vary in delimiter
 * (comma, semicolon, or tab) and quoting, so this auto-detects the delimiter
 * from the header line and handles RFC-4180 style double-quoted fields
 * (embedded delimiters, quotes escaped as ""). Deliberately small — it only
 * needs to cope with the tabular exports MetaTrader/cTrader produce, not every
 * CSV edge case.
 */

const DELIMITERS = [",", ";", "\t"] as const;

/**
 * Picks the delimiter whose multi-column line width is the most CONSISTENT over
 * the first several non-empty lines. Scanning several lines (not just line 1)
 * copes with broker "statement" CSVs that open with account/summary banner lines
 * that don't use the delimiter at all; scoring by consistency (how many lines
 * agree on the same width) instead of the maximum width keeps a single
 * comma-littered free-text cell from flipping a semicolon/tab file to commas.
 */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 15);
  let best = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const freq = new Map<number, number>();
    for (const line of lines) {
      const count = splitLine(line, d).length;
      if (count > 1) freq.set(count, (freq.get(count) ?? 0) + 1);
    }
    let score = 0;
    for (const n of freq.values()) score = Math.max(score, n);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** Splits a single line on `delimiter`, respecting double-quoted fields. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Parses delimited text into a header row + data rows. Blank lines are skipped.
 * A `delimiter` may be forced; otherwise it's auto-detected. Rows with a
 * different column count than the header are still returned (padded/truncated
 * defensively by the caller via index access) — broker exports occasionally
 * append summary lines the caller filters out by required-field presence.
 */
export function parseCsv(text: string, delimiter?: string): ParsedCsv {
  const delim = delimiter ?? detectDelimiter(text);
  // Strip a UTF-8 BOM some exporters prepend, which would otherwise corrupt the first header.
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitLine(lines[0], delim);
  const rows = lines.slice(1).map((l) => splitLine(l, delim));
  return { headers, rows };
}

/**
 * Maps our logical field names to their column index by matching each header
 * against a list of alias substrings (case-insensitive). This is what makes the
 * parsers tolerant of the many header-naming variants across broker/platform
 * versions — a real export only needs one alias to match. Returns -1 for a field
 * whose column is absent.
 */
export function detectColumns<F extends string>(
  headers: string[],
  aliases: Record<F, string[]>
): Record<F, number> {
  const lowered = headers.map((h) => h.toLowerCase().trim());
  const result = {} as Record<F, number>;
  for (const field of Object.keys(aliases) as F[]) {
    result[field] = -1;
    for (const alias of aliases[field]) {
      const a = alias.toLowerCase();
      // Prefer an exact header match; fall back to substring.
      let idx = lowered.findIndex((h) => h === a);
      if (idx === -1) idx = lowered.findIndex((h) => h.includes(a));
      if (idx !== -1) {
        result[field] = idx;
        break;
      }
    }
  }
  return result;
}

/** Safe cell read by (possibly -1) column index. */
export function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? row[idx] : "";
}
