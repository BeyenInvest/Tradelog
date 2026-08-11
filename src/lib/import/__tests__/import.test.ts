import { describe, it, expect } from "vitest";
import { parseNumber, parseDateOnly } from "../values";
import { normalizeSymbol } from "../symbols";
import { parseCsv, detectDelimiter, detectColumns } from "../csv";
import { resolveResultaatPct, deriveOutcome, dealToImportRow } from "../mapToTrade";
import { prepareImport } from "../prepare";
import { parseCtrader } from "../parsers/ctrader";
import { parseMt } from "../parsers/mt";
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
});
