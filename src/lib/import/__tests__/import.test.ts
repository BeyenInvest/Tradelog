import { describe, it, expect } from "vitest";
import { parseNumber, parseDateOnly } from "../values";
import { normalizeSymbol } from "../symbols";
import { parseCsv, detectDelimiter, detectColumns } from "../csv";
import { resolveResultaatPct, deriveOutcome, dealToImportRow } from "../mapToTrade";
import { prepareImport } from "../prepare";
import { parseCtrader } from "../parsers/ctrader";
import { parseMt } from "../parsers/mt";
import { parseTradingview } from "../parsers/tradingview";
import { detectBroker } from "../index";
import type { ParsedDeal } from "../types";

function deal(overrides: Partial<ParsedDeal>): ParsedDeal {
  return {
    ticket: "1",
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2024-03-15",
    closeTime: "2024-03-16",
    pnlAmount: null,
    returnPct: null,
    balanceAfter: null,
    raw: {},
    ...overrides,
  };
}

describe("parseNumber", () => {
  it("handles plain, thousands, and both-separator formats", () => {
    expect(parseNumber("1234.56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("1 234,56")).toBe(1234.56);
  });
  it("treats a lone comma as a decimal", () => {
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("1,234")).toBe(1234); // groups of 3 = thousands
  });
  it("reads negatives and parentheses", () => {
    expect(parseNumber("-12.34")).toBe(-12.34);
    expect(parseNumber("(12.34)")).toBe(-12.34);
  });
  it("reads the Unicode minus TradingView emits", () => {
    expect(parseNumber("−12.34")).toBe(-12.34); // U+2212, not the ASCII hyphen
    expect(parseNumber("−2.5")).toBe(-2.5);
  });
  it("returns null for blanks/junk", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("n/a")).toBeNull();
  });
  it("strips currency decoration", () => {
    expect(parseNumber("$1,000.00")).toBe(1000);
    expect(parseNumber("12.34 USD")).toBe(12.34);
  });
});

describe("parseDateOnly", () => {
  it("reads MetaTrader dotted, ISO, and day-first slash dates", () => {
    expect(parseDateOnly("2024.03.15 14:30:00")).toBe("2024-03-15");
    expect(parseDateOnly("2024-03-15T14:30:00.000")).toBe("2024-03-15");
    expect(parseDateOnly("15/03/2024 14:30")).toBe("2024-03-15");
  });
  it("uses month-first only when day-first is impossible", () => {
    expect(parseDateOnly("03/15/2024")).toBe("2024-03-15"); // 15 can't be a month
  });
  it("returns null when there is no date", () => {
    expect(parseDateOnly("total")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("normalizeSymbol", () => {
  it("passes through clean pairs", () => {
    expect(normalizeSymbol("EURUSD")).toBe("EURUSD");
    expect(normalizeSymbol("eurusd")).toBe("EURUSD");
  });
  it("strips broker suffixes and separators", () => {
    expect(normalizeSymbol("EURUSD.r")).toBe("EURUSD");
    expect(normalizeSymbol("GBPUSD.pro")).toBe("GBPUSD");
    expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
    expect(normalizeSymbol("GBPUSDm")).toBe("GBPUSD");
    expect(normalizeSymbol("XAUUSD.raw")).toBe("XAUUSD");
  });
  it("maps known metal aliases", () => {
    expect(normalizeSymbol("GOLD")).toBe("XAUUSD");
    expect(normalizeSymbol("SILVER")).toBe("XAGUSD");
  });
  it("returns null for instruments we don't track", () => {
    expect(normalizeSymbol("US30")).toBeNull();
    expect(normalizeSymbol("BTCUSD")).toBeNull();
  });
});

describe("csv", () => {
  it("detects delimiter and parses quoted fields", () => {
    const text = 'a;b;c\n1;"two; still two";3';
    expect(detectDelimiter(text)).toBe(";");
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows[0]).toEqual(["1", "two; still two", "3"]);
  });
  it("maps columns by alias, exact match beating substring", () => {
    const cols = detectColumns(["Symbol", "Net Profit", "Balance"], {
      symbol: ["symbol"],
      net: ["net profit", "profit"],
      balance: ["balance"],
    });
    expect(cols).toEqual({ symbol: 0, net: 1, balance: 2 });
  });
});

describe("resolveResultaatPct", () => {
  it("prefers an explicit broker return %", () => {
    expect(resolveResultaatPct(deal({ returnPct: 2.5, pnlAmount: 999, balanceAfter: 1 }), 100)).toBe(2.5);
  });
  it("derives an exact % from the running balance (balance_before = after - pnl)", () => {
    // pnl 100 on a balance that ended at 1100 → started at 1000 → +10%
    expect(resolveResultaatPct(deal({ pnlAmount: 100, balanceAfter: 1100 }), null)).toBe(10);
  });
  it("falls back to the entered account balance", () => {
    expect(resolveResultaatPct(deal({ pnlAmount: 50 }), 1000)).toBe(5);
    expect(resolveResultaatPct(deal({ pnlAmount: -20 }), 1000)).toBe(-2);
  });
  it("returns null when no basis is available", () => {
    expect(resolveResultaatPct(deal({ pnlAmount: 50 }), null)).toBeNull();
  });
});

describe("deriveOutcome", () => {
  it("uses the sign of the % with a break-even epsilon", () => {
    expect(deriveOutcome(1.2)).toBe("Win");
    expect(deriveOutcome(-1.2)).toBe("Loss");
    expect(deriveOutcome(0)).toBe("BE");
    expect(deriveOutcome(0.001)).toBe("BE");
  });
});

describe("dealToImportRow", () => {
  it("builds a neutral, taken (never missed) trade with an import_ref", () => {
    const row = dealToImportRow(deal({ ticket: "42", symbol: "EURUSD.r" }), "EURUSD", "EURUSD", 3.2, "ctrader");
    expect(row.import_ref).toBe("ctrader:42");
    expect(row.trade_evaluation).toBeNull(); // imports are never "Missed trade"
    expect(row.outcome).toBe("Win");
    expect(row.resultaat_pct).toBe(3.2);
    expect(row.fase).toBe("Fase 1");
    expect(row.datum_open).toBe("2024-03-15");
  });
  it("falls back to close date when open date is missing", () => {
    const row = dealToImportRow(deal({ openTime: null, closeTime: "2024-05-01" }), "EURUSD", "EURUSD", -1, "mt");
    expect(row.datum_open).toBe("2024-05-01");
    expect(row.outcome).toBe("Loss");
  });
  it("keeps pair and instrument as given (forex mirrors, non-forex carries the raw symbol)", () => {
    const forex = dealToImportRow(deal({ symbol: "GBPUSD.r" }), "GBPUSD", "GBPUSD", 1, "ctrader");
    expect(forex.pair).toBe("GBPUSD");
    expect(forex.instrument).toBe("GBPUSD");
    const stock = dealToImportRow(deal({ symbol: "AAPL" }), "EURUSD", "AAPL", 1, "ctrader");
    expect(stock.pair).toBe("EURUSD"); // placeholder, ignored by non-forex views
    expect(stock.instrument).toBe("AAPL");
  });
});

describe("prepareImport", () => {
  const opts = { pairMap: {}, accountBalance: 1000, existingImportRefs: new Set<string>() };

  it("resolves ready rows and collects unknown symbols distinctly", () => {
    const deals = [
      deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100 }),
      deal({ ticket: "2", symbol: "US30", pnlAmount: 100 }),
      deal({ ticket: "3", symbol: "US30", pnlAmount: 100 }),
    ];
    const res = prepareImport(deals, "ctrader", opts);
    expect(res.rows).toHaveLength(1);
    expect(res.unknownSymbols).toEqual(["US30"]);
  });

  it("skips duplicates by import_ref", () => {
    const deals = [deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100 })];
    const res = prepareImport(deals, "ctrader", {
      ...opts,
      existingImportRefs: new Set(["ctrader:1"]),
    });
    expect(res.rows).toHaveLength(0);
    expect(res.duplicateCount).toBe(1);
  });

  it("flags when a balance is needed and imports once given", () => {
    const deals = [deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100 })];
    const noBalance = prepareImport(deals, "ctrader", { ...opts, accountBalance: null });
    expect(noBalance.needsBalance).toBe(true);
    expect(noBalance.rows).toHaveLength(0);

    const withBalance = prepareImport(deals, "ctrader", { ...opts, accountBalance: 1000 });
    expect(withBalance.rows).toHaveLength(1);
    expect(withBalance.rows[0].resultaat_pct).toBe(10);
  });

  it("counts undated deals as skipped", () => {
    const deals = [deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100, openTime: null, closeTime: null })];
    const res = prepareImport(deals, "ctrader", opts);
    expect(res.undatedCount).toBe(1);
    expect(res.rows).toHaveLength(0);
  });

  it("non-forex journal keeps raw symbols as instrument, never flagging unknowns", () => {
    const deals = [
      deal({ ticket: "1", symbol: "AAPL", pnlAmount: 100 }),
      deal({ ticket: "2", symbol: "US30", pnlAmount: 100 }), // would be "unknown" for a forex journal
    ];
    const res = prepareImport(deals, "ctrader", { ...opts, forexJournal: false });
    expect(res.unknownSymbols).toEqual([]);
    expect(res.rows).toHaveLength(2);
    expect(res.rows.map((r) => r.instrument)).toEqual(["AAPL", "US30"]);
    expect(res.rows.every((r) => r.pair === "EURUSD")).toBe(true); // placeholder
  });

  it("counts symbol-less deals separately (TradingView exports name no symbol)", () => {
    const deals = [
      deal({ ticket: "1", symbol: "", pnlAmount: 100 }),
      deal({ ticket: "2", symbol: "EURUSD", pnlAmount: 100 }),
    ];
    const res = prepareImport(deals, "tradingview", opts);
    expect(res.missingSymbolCount).toBe(1);
    expect(res.rows).toHaveLength(1);
    expect(res.unknownSymbols).toEqual([]); // "" must never appear as an unknown symbol

    const nonForex = prepareImport(deals, "tradingview", { ...opts, forexJournal: false });
    expect(nonForex.missingSymbolCount).toBe(1);
    expect(nonForex.rows).toHaveLength(1);
  });

  it("dedupes a repeated import_ref within the same batch (never emits a colliding row)", () => {
    // Two deals with the same ticket would map to the same import_ref, and the
    // DB's partial unique index would abort the whole bulk insert. The planner
    // must keep only the first and count the rest as duplicates.
    const deals = [
      deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100 }),
      deal({ ticket: "1", symbol: "EURUSD", pnlAmount: 100 }),
    ];
    const res = prepareImport(deals, "ctrader", opts);
    expect(res.rows).toHaveLength(1);
    expect(res.duplicateCount).toBe(1);
    // No two prepared rows may ever share an import_ref.
    expect(new Set(res.rows.map((r) => r.import_ref)).size).toBe(res.rows.length);
  });
});

describe("parsers end-to-end", () => {
  it("parses a cTrader-style deals CSV", () => {
    const csv = [
      "Deal ID,Symbol,Direction,Entry Time,Close Time,Net USD,Balance",
      "1001,EURUSD,Buy,2024.03.15 10:00:00,2024.03.15 12:00:00,100,1100",
      "1002,GBPUSD.r,Sell,2024.03.16 09:00:00,2024.03.16 11:00:00,-50,1050",
      ",,,,,,", // junk/summary line
    ].join("\n");
    const res = parseCtrader(csv);
    expect(res.broker).toBe("ctrader");
    expect(res.deals).toHaveLength(2);
    expect(res.deals[0]).toMatchObject({ ticket: "1001", symbol: "EURUSD", pnlAmount: 100, balanceAfter: 1100 });

    const prepared = prepareImport(res.deals, "ctrader", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(),
    });
    // Both derive % from the running balance, so no account balance is needed.
    expect(prepared.needsBalance).toBe(false);
    expect(prepared.rows).toHaveLength(2);
    expect(prepared.rows[0].resultaat_pct).toBe(10); // 100 on 1000-before
  });

  it("parses a cTrader deals export and derives % from the running balance", () => {
    // The documented cTrader History→Deals columns (Order ID, Symbol, Opening
    // direction, Opening/Closing time, Net (currency), Balance (currency), Swap,
    // Commissions) all resolve through the shared aliases, and the running Balance
    // column yields an exact per-trade % without the user entering an account balance.
    const csv = [
      "Order ID,Symbol,Opening direction,Closing direction,Opening time,Closing time,Swap,Commissions,Net (currency),Balance (currency)",
      "501,EURUSD,Buy,Sell,2026-05-08 10:00:00,2026-05-08 12:00:00,0.00,-3.50,116.50,10116.50",
      "502,GBPUSD,Sell,Buy,2026-05-09 09:00:00,2026-05-09 11:00:00,-1.00,-3.50,-49.50,10067.00",
    ].join("\n");
    const res = parseCtrader(csv);
    expect(res.deals).toHaveLength(2);
    expect(res.deals[0]).toMatchObject({
      ticket: "501",
      symbol: "EURUSD",
      direction: "buy",
      pnlAmount: 116.5, // Net (currency) used directly
      balanceAfter: 10116.5,
    });
    const prepared = prepareImport(res.deals, "ctrader", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(),
    });
    expect(prepared.needsBalance).toBe(false); // running Balance → exact %, no manual balance
    expect(prepared.rows.map((r) => r.resultaat_pct)).toEqual([1.17, -0.49]);
  });

  it("finds the real header under leading banner rows in a cTrader statement export", () => {
    // A cTrader "statement" CSV can open with account/period banner lines before
    // the column header — the same trap the MetaTrader HTML statement sprang. The
    // header must be located by content, not assumed to be line 1.
    const csv = [
      "cTrader Statement",
      "Account: 123456 (USD)",
      "Period: 2026-05-01 - 2026-05-31",
      "",
      "Order ID,Symbol,Opening direction,Opening time,Closing time,Net (currency),Balance (currency)",
      "501,EURUSD,Buy,2026-05-08 10:00:00,2026-05-08 12:00:00,116.50,10116.50",
    ].join("\n");
    const res = parseCtrader(csv);
    expect(res.deals).toHaveLength(1);
    expect(res.deals[0]).toMatchObject({ ticket: "501", symbol: "EURUSD", pnlAmount: 116.5 });
  });

  it("parses a TradingView export using the newer P&L column naming", () => {
    // TradingView relabelled the Strategy Tester "Profit" columns to "P&L"; the
    // aliases cover both, and the Unicode minus it emits is normalised.
    const csv = [
      "Trade #,Type,Signal,Date/Time,Price USD,Quantity,P&L USD,P&L %,Cumulative P&L USD,Cumulative P&L %",
      "1,Exit long,TP,2026-03-16 12:00,1.0800,1,100.00,4.87,100,4.87",
      "1,Entry long,Long,2026-03-15 10:00,1.0600,1,,,,",
    ].join("\n");
    const res = parseTradingview(csv);
    expect(res.deals).toHaveLength(1);
    expect(res.deals[0]).toMatchObject({
      direction: "buy",
      openTime: "2026-03-15",
      closeTime: "2026-03-16",
      returnPct: 4.87,
    });
  });

  it("keeps same-day, same-result deals distinct when the export has no ticket column", () => {
    // No ID/ticket column, so the parser builds a fallback id. Two genuinely
    // distinct scalps on the same day with the same result (times are dropped)
    // must not collapse into one ref — otherwise one is lost and the bulk insert
    // could abort on the duplicate.
    const csv = [
      "Symbol,Direction,Close Time,Net USD,Balance",
      "EURUSD,Buy,2024.03.15 10:00:00,50,1050",
      "EURUSD,Buy,2024.03.15 14:00:00,50,1100",
    ].join("\n");
    const res = parseCtrader(csv);
    expect(res.deals).toHaveLength(2);
    expect(res.deals[0].ticket).not.toBe(res.deals[1].ticket);

    const prepared = prepareImport(res.deals, "ctrader", {
      pairMap: {},
      accountBalance: 1000,
      existingImportRefs: new Set(),
    });
    expect(prepared.rows).toHaveLength(2);
    expect(prepared.duplicateCount).toBe(0);
    expect(new Set(prepared.rows.map((r) => r.import_ref)).size).toBe(2);
  });

  it("parses a TradingView Strategy Tester export (paired entry/exit rows, newest first)", () => {
    const csv = [
      "Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD,Profit %,Cum. Profit USD,Cum. Profit %,Run-up USD,Run-up %,Drawdown USD,Drawdown %",
      "2,Exit short,Cover,2024-03-20 15:00,1.0700,1,−25.00,−2.5,75,7.5,5,0.5,30,3",
      "2,Entry short,Short,2024-03-19 09:00,1.0650,1,,,,,,,,",
      "1,Exit long,TP,2024-03-16 12:00,1.0800,1,100.00,4.87,100,4.87,10,1,5,0.5",
      "1,Entry long,Long,2024-03-15 10:00,1.0600,1,,,,,,,,",
    ].join("\n");
    const res = parseTradingview(csv);
    expect(res.broker).toBe("tradingview");
    expect(res.deals).toHaveLength(2);

    const t2 = res.deals.find((d) => d.ticket.startsWith("2|"))!;
    expect(t2).toMatchObject({ direction: "sell", openTime: "2024-03-19", closeTime: "2024-03-20", returnPct: -2.5 });
    const t1 = res.deals.find((d) => d.ticket.startsWith("1|"))!;
    expect(t1).toMatchObject({ direction: "buy", openTime: "2024-03-15", closeTime: "2024-03-16", returnPct: 4.87 });
    // No symbol column in this export — the dialog asks the user for one.
    expect(res.deals.every((d) => d.symbol === "")).toBe(true);

    // With the file-wide symbol applied, Profit % is used verbatim — no balance needed.
    const withSymbol = res.deals.map((d) => ({ ...d, symbol: "EURUSD" }));
    const prepared = prepareImport(withSymbol, "tradingview", {
      pairMap: {},
      accountBalance: null,
      existingImportRefs: new Set(),
    });
    expect(prepared.needsBalance).toBe(false);
    expect(prepared.rows).toHaveLength(2);
    expect(prepared.rows.map((r) => r.resultaat_pct).sort((a, b) => a - b)).toEqual([-2.5, 4.87]);
  });

  it("skips a still-open TradingView trade and sums scale-out exits", () => {
    const csv = [
      "Trade #,Type,Signal,Date/Time,Price USD,Contracts,Profit USD,Profit %",
      "3,Entry long,Long,2024-04-01 10:00,1.0600,2,,",
      "2,Exit long,TP2,2024-03-21 15:00,1.0750,1,30.00,1.5",
      "2,Exit long,TP1,2024-03-20 12:00,1.0700,1,20.00,1.0",
      "2,Entry long,Long,2024-03-19 09:00,1.0650,2,,",
    ].join("\n");
    const res = parseTradingview(csv);
    // Trade 3 has no exit yet → skipped with a structured warning.
    expect(res.deals).toHaveLength(1);
    expect(res.warnings).toEqual([{ kind: "openTrades", count: 1 }]);
    // Trade 2 scale-out: both exits summed, close = last exit seen.
    expect(res.deals[0].returnPct).toBe(2.5);
    expect(res.deals[0].pnlAmount).toBe(50);
  });

  it("routes a flat (non-paired) TradingView positions export through the generic table path", () => {
    const csv = [
      "Symbol,Side,Closing Time,P/L,Balance",
      "EURUSD,Buy,2024-03-15 12:00,100,1100",
    ].join("\n");
    const res = parseTradingview(csv);
    expect(res.deals).toHaveLength(1);
    expect(res.deals[0]).toMatchObject({ symbol: "EURUSD", pnlAmount: 100, balanceAfter: 1100 });
  });

  it("detects a Strategy Tester file from its header trio", () => {
    const csv = "Trade #,Type,Signal,Date/Time,Price USD\n1,Entry long,Long,2024-03-15 10:00,1.06";
    expect(detectBroker(csv, "chart.csv")).toBe("tradingview");
    expect(detectBroker("Deal ID,Symbol,Net USD\n1,EURUSD,5", "history_ctrader.csv")).toBe("ctrader");
  });

  it("parses a MetaTrader HTML statement table", () => {
    const html = `
      <html><body>
      <table>
        <tr><td>Report</td></tr>
        <tr><th>Ticket</th><th>Symbol</th><th>Type</th><th>Open Time</th><th>Close Time</th><th>Profit</th></tr>
        <tr><td>500</td><td>eurusd</td><td>buy</td><td>2024.03.15 10:00</td><td>2024.03.15 12:00</td><td>25.00</td></tr>
      </table>
      </body></html>`;
    const res = parseMt(html);
    expect(res.broker).toBe("mt");
    expect(res.deals).toHaveLength(1);
    expect(res.deals[0]).toMatchObject({ ticket: "500", symbol: "eurusd", pnlAmount: 25 });
  });

  it("parses a real-shape FTMO MetaTrader statement (banner + Item column + space thousands)", () => {
    // Mirrors the structure of an actual FTMO "Save as Report" export, which broke
    // the naive parser: (1) a multi-cell Account/Name/Currency/Leverage banner
    // precedes the real header, so the header must be the WIDEST row, not the first
    // row with >1 cell; (2) the symbol column is labelled "Item"; (3) the balance
    // seed row, cancelled pending orders (colspan-merged "cancelled" cell), and the
    // total/summary rows carry no importable figure and must be skipped; (4) profit
    // uses a space as the thousands separator ("1 116.36").
    const html = `
      <html><body><div align=center>
      <table cellspacing=1 cellpadding=3 border=0>
      <tr align=left>
        <td colspan=2><b>Account: 431037290</b></td>
        <td colspan=5><b>Name: $100k FTMO Account Swing 2-Step</b></td>
        <td colspan=2><b>Currency: USD</b></td>
        <td colspan=2><b>Leverage: 1:100</b></td>
        <td colspan=3 align=right><b>2026 August 18, 19:44</b></td></tr>
      <tr align=left><td colspan=14><b>Closed Transactions:</b></td></tr>
      <tr align=center bgcolor="#C0C0C0">
        <td>Ticket</td><td nowrap>Open Time</td><td>Type</td><td>Size</td><td>Item</td>
        <td>Price</td><td>S / L</td><td>T / P</td><td nowrap>Close Time</td>
        <td>Price</td><td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td></tr>
      <tr align=right><td>44408909</td><td>2026.05.06 11:48:58</td><td>balance</td><td colspan=10 align=left>Initial account balance</td><td>100 000.00</td></tr>
      <tr align=right><td>44469036</td><td>2026.05.08 01:00:57</td><td>sell</td><td>2.93</td><td>eurcad</td><td>1.60198</td><td>1.60550</td><td>1.58750</td><td>2026.05.08 11:30:10</td><td>1.60556</td><td>-14.65</td><td>0.00</td><td>0.00</td><td>-768.05</td></tr>
      <tr align=right><td>44469084</td><td>2026.05.08 00:16:40</td><td>sell limit</td><td>2.78</td><td>nzdusd</td><td>0.59690</td><td>0.59960</td><td>0.59150</td><td>2026.05.08 10:51:49</td><td>0.59506</td><td colspan=4>cancelled</td></tr>
      <tr align=right><td>44903674</td><td>2026.05.26 01:11:01</td><td>buy</td><td>3.67</td><td>eurchf</td><td>0.91122</td><td>0.91120</td><td>0.91400</td><td>2026.05.26 21:49:27</td><td>0.91361</td><td>-18.35</td><td>0.00</td><td>0.00</td><td>1 116.36</td></tr>
      <tr align=right><td colspan=10>&nbsp;</td><td>-597.45</td><td>0.00</td><td>-156.31</td><td>-5 384.02</td></tr>
      <tr align=right><td colspan=12 align=right><b>Closed P/L:</b></td><td colspan=2 align=right>-6 137.78</td></tr>
      </table></div></body></html>`;
    const res = parseMt(html);
    expect(res.broker).toBe("mt");
    // Only the two executed buy/sell deals — balance seed, cancelled order and the
    // two summary rows are skipped.
    expect(res.deals).toHaveLength(2);
    expect(res.warnings).toEqual([{ kind: "skippedRows", count: 4 }]);

    const eurcad = res.deals.find((d) => d.symbol === "eurcad")!;
    expect(eurcad).toMatchObject({ ticket: "44469036", direction: "sell", openTime: "2026-05-08", closeTime: "2026-05-08" });
    expect(eurcad.pnlAmount).toBeCloseTo(-782.7, 2); // profit -768.05 + commission -14.65 + swap 0

    const eurchf = res.deals.find((d) => d.symbol === "eurchf")!;
    expect(eurchf).toMatchObject({ direction: "buy" });
    expect(eurchf.pnlAmount).toBeCloseTo(1098.01, 2); // 1 116.36 + (-18.35) — space thousands parsed

    // End-to-end: a forex journal with the account balance entered resolves both to %.
    const prepared = prepareImport(res.deals, "mt", {
      pairMap: {},
      accountBalance: 100000,
      existingImportRefs: new Set(),
      forexJournal: true,
    });
    expect(prepared.rows).toHaveLength(2);
    expect(prepared.unknownSymbols).toEqual([]);
    const byPair = Object.fromEntries(prepared.rows.map((r) => [r.pair, r]));
    expect(byPair.EURCAD).toMatchObject({ instrument: "EURCAD", direction: "Short", outcome: "Loss", resultaat_pct: -0.78 });
    expect(byPair.EURCHF).toMatchObject({ instrument: "EURCHF", direction: "Long", outcome: "Win", resultaat_pct: 1.1 });
  });
});
