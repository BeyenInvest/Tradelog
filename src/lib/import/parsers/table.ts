import { cell, detectColumns } from "../csv";
import { parseNumber, parseDateOnly } from "../values";
import type { ParsedDeal } from "../types";

/**
 * Header aliases per logical field. Broad on purpose — a real export only needs
 * one alias to match, which is what lets the same engine read MetaTrader and
 * cTrader (and their many broker-relabelled variants) without hard-coding one
 * exact column layout. Add aliases here as real exports reveal new labels.
 */
const ALIASES = {
  ticket: ["deal id", "position id", "order id", "ticket", "deal", "order", "position", "id"],
  symbol: ["symbol", "instrument", "pair", "market"],
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
export function tableToDeals(headers: string[], rows: string[][]): { deals: ParsedDeal[]; warnings: string[] } {
  const cols = detectColumns<Field>(headers, ALIASES as unknown as Record<Field, string[]>);
  const deals: ParsedDeal[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  rows.forEach((row, rowIndex) => {
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
    // Stable fallback id when the export has no ticket column, so dedup still works.
    // The row index keeps two genuinely distinct deals apart when they share a
    // symbol/date/P&L (dates are day-only, so same-day scalps with identical results
    // would otherwise collapse to one ref — and a duplicate ref aborts the whole
    // bulk insert). It stays stable across re-imports of the same file, so
    // re-importing is still an idempotent no-op via the import_ref dedup.
    const ticket =
      detectedTicket || `r${rowIndex}|${symbol}|${openTime ?? ""}|${closeTime ?? ""}|${pnlAmount ?? returnPct ?? ""}`;

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

  if (skipped > 0) warnings.push(`${skipped} rij(en) overgeslagen (geen herkenbare trade-gegevens).`);
  return { deals, warnings };
}
