import { parseCsv, detectColumns, cell } from "../csv";
import { parseNumber, parseDateOnly } from "../values";
import { tableToDeals, locateTable } from "./table";
import type { ParseResult, ParsedDeal, ParseWarning } from "../types";

/**
 * Column aliases for the Strategy Tester "List of Trades" download. The amount
 * aliases carry a currency variant first ("profit usd") so the exact-match pass
 * wins before the bare "profit" substring can land on "Profit %" — and the
 * detector's exact-before-substring order keeps "Cum. Profit USD" from stealing
 * the plain profit column.
 */
const ALIASES = {
  tradeNo: ["trade #", "trade#", "trade"],
  type: ["type"],
  dateTime: ["date/time", "date time", "datetime", "date"],
  profitPct: ["profit %", "profit%", "p&l %", "pl %"],
  profitAmount: ["profit usd", "profit eur", "p&l usd", "profit", "p&l", "pl"],
  symbol: ["symbol", "instrument", "ticker", "market"],
} as const;

type Field = keyof typeof ALIASES;

/**
 * TradingView export. Two real-world shapes:
 *
 * 1. Strategy Tester → "List of Trades" download: one trade = a PAIR of rows
 *    sharing a "Trade #" — an "Entry long/short" row (open date, direction) and
 *    an "Exit …" row (close date, profit). No symbol column at all (the export
 *    is per-chart), so `symbol` stays "" and the import dialog asks the user
 *    for one symbol covering the whole file. "Profit %" is used verbatim when
 *    present, so no account balance is needed for backtest imports.
 *
 * 2. Paper-trading / positions history: a flat one-row-per-trade table — handed
 *    to the shared column detector like any broker CSV.
 *
 * The paired shape is detected per-file (a Trade-# column plus Entry/Exit type
 * values); anything else falls through to the flat path.
 */
export function parseTradingview(text: string): ParseResult {
  const { headers, rows } = parseCsv(text);
  const cols = detectColumns<Field>(headers, ALIASES as unknown as Record<Field, string[]>);

  const paired =
    cols.tradeNo !== -1 &&
    cols.type !== -1 &&
    rows.some((r) => /\b(entry|exit)\b/i.test(cell(r, cols.type)));

  if (!paired) {
    const table = locateTable([headers, ...rows]);
    const { deals, warnings } = tableToDeals(table.headers, table.rows);
    return { broker: "tradingview", deals, warnings };
  }

  return { broker: "tradingview", ...pairedRowsToDeals(headers, rows, cols) };
}

interface TradeGroup {
  tradeNo: string;
  symbol: string;
  direction: "buy" | "sell" | null;
  openTime: string | null;
  closeTime: string | null;
  profitPct: number | null;
  pnlAmount: number | null;
  hasEntry: boolean;
  hasExit: boolean;
  raw: Record<string, string>;
}

/** Folds entry/exit row pairs (grouped on Trade #) into one ParsedDeal per trade. */
function pairedRowsToDeals(
  headers: string[],
  rows: string[][],
  cols: Record<Field, number>
): { deals: ParsedDeal[]; warnings: ParseWarning[] } {
  const groups = new Map<string, TradeGroup>();
  const order: string[] = []; // Map preserves insertion order, but keep explicit for clarity

  for (const row of rows) {
    const tradeNo = cell(row, cols.tradeNo).trim();
    const type = cell(row, cols.type).trim();
    if (!tradeNo || !type) continue; // summary/junk line

    let group = groups.get(tradeNo);
    if (!group) {
      group = {
        tradeNo,
        symbol: cell(row, cols.symbol).trim(),
        direction: null,
        openTime: null,
        closeTime: null,
        profitPct: null,
        pnlAmount: null,
        hasEntry: false,
        hasExit: false,
        raw: Object.fromEntries(headers.map((h, i) => [h, cell(row, i)])),
      };
      groups.set(tradeNo, group);
      order.push(tradeNo);
    }

    const date = parseDateOnly(cell(row, cols.dateTime));
    if (/entry/i.test(type)) {
      group.hasEntry = true;
      group.openTime = group.openTime ?? date;
      if (/long|buy/i.test(type)) group.direction = "buy";
      else if (/short|sell/i.test(type)) group.direction = "sell";
    } else if (/exit/i.test(type)) {
      group.hasExit = true;
      group.closeTime = date ?? group.closeTime; // scale-outs: keep the last exit's date
      // A scale-out spreads the trade's P&L over several exit rows — sum them so
      // the imported trade carries the whole result.
      const pct = parseNumber(cell(row, cols.profitPct));
      if (pct != null) group.profitPct = (group.profitPct ?? 0) + pct;
      const amount = parseNumber(cell(row, cols.profitAmount));
      if (amount != null) group.pnlAmount = (group.pnlAmount ?? 0) + amount;
      // The exit row also names the direction ("Exit long" closes a long).
      if (group.direction == null) {
        if (/long/i.test(type)) group.direction = "buy";
        else if (/short/i.test(type)) group.direction = "sell";
      }
    }
  }

  const deals: ParsedDeal[] = [];
  let openCount = 0;
  for (const tradeNo of order) {
    const g = groups.get(tradeNo)!;
    if (!g.hasExit) {
      openCount++; // still-open position at export time — no result to import
      continue;
    }
    deals.push({
      // Stable per-file id. Trade #s restart at 1 in every export, so the dates +
      // result are folded in to keep two different backtests from colliding on
      // the same import_ref — while a re-import of the same file still dedupes.
      ticket: `${g.tradeNo}|${g.symbol}|${g.openTime ?? ""}|${g.closeTime ?? ""}|${g.profitPct ?? g.pnlAmount ?? ""}`,
      symbol: g.symbol,
      direction: g.direction,
      openTime: g.openTime,
      closeTime: g.closeTime,
      pnlAmount: g.pnlAmount,
      returnPct: g.profitPct,
      balanceAfter: null,
      raw: g.raw,
    });
  }

  const warnings: ParseWarning[] = [];
  if (openCount > 0) warnings.push({ kind: "openTrades", count: openCount });
  return { deals, warnings };
}
