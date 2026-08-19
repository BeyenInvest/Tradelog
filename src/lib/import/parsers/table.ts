import { cell, detectColumns, parseCsv } from "../csv";
import { parseNumber, parseDateOnly } from "../values";
import type { ImportBroker, ParsedDeal, ParseResult, ParseWarning } from "../types";

/**
 * Header aliases per logical field. Broad on purpose — a real export only needs
 * one alias to match, which is what lets the same engine read MetaTrader and
 * cTrader (and their many broker-relabelled variants) without hard-coding one
 * exact column layout. Add aliases here as real exports reveal new labels.
 */
const ALIASES = {
  ticket: ["deal id", "position id", "order id", "ticket", "deal", "order", "position", "id"],
  symbol: ["symbol", "instrument", "pair", "market", "item"],
  direction: ["direction", "trade side", "side", "type"],
  openTime: ["entry time", "open time", "opening time", "entry", "open"],
  closeTime: ["close time", "closing time", "exit time", "close"],
  net: ["net profit", "net usd", "net", "closing p/l", "closed p/l", "p/l", "pnl", "profit/loss"],
  profit: ["profit", "gross profit", "gross usd", "gross"],
  commission: ["commission", "commissions", "fee"],
  swap: ["swap", "rollover", "storage"],
  returnPct: ["return %", "% return", "return", "roi", "gain %"],
  balance: ["balance after", "balance", "account balance", "equity"],
} as const;

type Field = keyof typeof ALIASES;

function direction(raw: string): "buy" | "sell" | null {
  const s = raw.toLowerCase();
  if (s.includes("buy") || s.includes("long")) return "buy";
  if (s.includes("sell") || s.includes("short")) return "sell";
  return null;
}

/**
 * Locates the real header row in a parsed CSV and splits it from the data. A
 * broker "statement" CSV (cTrader, some white-labels) can prepend account/period
 * banner lines before the column header — the same trap the MetaTrader HTML
 * statement sprang (see extractLargestTable). Each of the first rows is scored by
 * how many known columns it yields (requiring a symbol column, so a stray
 * label/number row can't pose as the header); the best-scoring, earliest row wins.
 * A clean export whose header is already the first row is unaffected — data rows
 * match no header alias, so they score zero.
 */
export function locateTable(allRows: string[][]): { headers: string[]; rows: string[][] } {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(allRows.length, 15);
  for (let i = 0; i < limit; i++) {
    const cols = detectColumns<Field>(allRows[i], ALIASES as unknown as Record<Field, string[]>);
    const detected = Object.values(cols).filter((v) => v !== -1).length;
    const score = cols.symbol !== -1 ? detected : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return { headers: allRows[bestIdx] ?? [], rows: allRows.slice(bestIdx + 1) };
}

/**
 * The shared flat-CSV pipeline (parseCsv → locateTable → tableToDeals) behind
 * parseCtrader, parseMt's CSV branch and parseGeneric — one place for future
 * banner/delimiter fixes instead of three drifting copies.
 */
export function parseFlatCsv(text: string, broker: ImportBroker): ParseResult {
  const { headers, rows } = parseCsv(text);
  const table = locateTable([headers, ...rows]);
  const { deals, warnings } = tableToDeals(table.headers, table.rows);
  return { broker, deals, warnings };
}

/**
 * Turns a detected header row + data rows into broker-neutral ParsedDeals.
 * Rows without both a symbol and any recognisable P&L/return figure are treated
 * as summary/junk lines (broker exports append totals) and reported as skipped
 * warnings rather than becoming bogus trades.
 *
 * Net account impact is resolved as: an explicit net column, else
 * profit + commission + swap (each defaulting to 0) — matching how MetaTrader
 * splits a deal's profit from its swap/commission, while cTrader tends to carry
 * a ready "Net" column.
 */
export function tableToDeals(headers: string[], rows: string[][]): { deals: ParsedDeal[]; warnings: ParseWarning[] } {
  const cols = detectColumns<Field>(headers, ALIASES as unknown as Record<Field, string[]>);
  const deals: ParsedDeal[] = [];
  const warnings: ParseWarning[] = [];
  // Occurrence counter per fallback-ticket content — see the fallback comment below.
  const fallbackSeen = new Map<string, number>();
  let skipped = 0;
  let openTrades = 0;

  rows.forEach((row) => {
    const symbol = cell(row, cols.symbol).trim();
    const net = parseNumber(cell(row, cols.net));
    const profit = parseNumber(cell(row, cols.profit));
    const commission = parseNumber(cell(row, cols.commission)) ?? 0;
    const swap = parseNumber(cell(row, cols.swap)) ?? 0;
    const returnPct = parseNumber(cell(row, cols.returnPct));
    const balanceAfter = parseNumber(cell(row, cols.balance));

    let pnlAmount: number | null = null;
    if (net != null) pnlAmount = net;
    else if (profit != null) pnlAmount = profit + commission + swap;

    // A row is a real deal only if it names an instrument and carries some figure.
    if (!symbol || (pnlAmount == null && returnPct == null)) {
      skipped++;
      return;
    }

    const detectedTicket = cell(row, cols.ticket).trim();
    const openTime = parseDateOnly(cell(row, cols.openTime));
    const closeTime = parseDateOnly(cell(row, cols.closeTime));

    // A row with an open time but no close time is a still-open position: a full
    // MetaTrader "Save as Report" statement carries its "Open Trades:" section in
    // the SAME table as the closed deals, and an open position's floating P&L
    // must not import as a finished trade. Only applies when the table has a
    // close-time column at all — exports without one describe closed deals only.
    if (cols.closeTime !== -1 && closeTime == null && openTime != null) {
      openTrades++;
      return;
    }

    // Stable fallback id when the export has no ticket column, so dedup still
    // works. Content-based — NOT row-index-based — so a fuller or re-windowed
    // re-export keeps the same refs for already-imported deals. The occurrence
    // counter keeps two genuinely distinct deals apart when they share a
    // symbol/date/P&L (dates are day-only, so same-day scalps with identical
    // results would otherwise collapse to one ref — and a duplicate ref aborts
    // the whole bulk insert). The first occurrence carries no suffix, matching
    // refs imported under the original content-based format.
    let ticket = detectedTicket;
    if (!ticket) {
      const base = `${symbol}|${openTime ?? ""}|${closeTime ?? ""}|${pnlAmount ?? returnPct ?? ""}`;
      const n = (fallbackSeen.get(base) ?? 0) + 1;
      fallbackSeen.set(base, n);
      ticket = n === 1 ? base : `${base}#${n}`;
    }

    deals.push({
      ticket,
      symbol,
      direction: direction(cell(row, cols.direction)),
      openTime,
      closeTime,
      pnlAmount,
      returnPct,
      balanceAfter,
      raw: Object.fromEntries(headers.map((h, i) => [h, cell(row, i)])),
    });
  });

  if (skipped > 0) warnings.push({ kind: "skippedRows", count: skipped });
  if (openTrades > 0) warnings.push({ kind: "openTrades", count: openTrades });
  return { deals, warnings };
}
