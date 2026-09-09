import { describe, expect, it } from "vitest";
import { csvColumns, rowsToCsv } from "./exportCsv";

describe("csvColumns", () => {
  it("unions keys across rows in first-seen order", () => {
    expect(
      csvColumns([
        { a: 1, b: 2 },
        { b: 3, c: 4 },
      ]),
    ).toEqual(["a", "b", "c"]);
  });

  it("returns empty for no rows", () => {
    expect(csvColumns([])).toEqual([]);
  });
});

describe("rowsToCsv", () => {
  it("renders header + rows with CRLF", () => {
    const csv = rowsToCsv([
      { pair: "EURUSD", resultaat_pct: 1.9, outcome: "Win" },
      { pair: "US30", resultaat_pct: -1, outcome: "Loss" },
    ]);
    expect(csv).toBe("pair,resultaat_pct,outcome\r\nEURUSD,1.9,Win\r\nUS30,-1,Loss");
  });

  it("serializes null/undefined as empty and objects as JSON", () => {
    const csv = rowsToCsv([{ notes: null, custom: { setup: "OB retrace" } }]);
    expect(csv).toBe('notes,custom\r\n,"{""setup"":""OB retrace""}"');
  });

  it("quotes cells containing delimiters, quotes or newlines", () => {
    const csv = rowsToCsv([{ a: 'zeg "hoi", oké', b: "regel1\nregel2", c: "gewoon" }]);
    expect(csv).toBe('a,b,c\r\n"zeg ""hoi"", oké","regel1\nregel2",gewoon');
  });

  it("fills missing keys of a row with empty cells", () => {
    const csv = rowsToCsv([{ a: 1, b: 2 }, { a: 3 }]);
    expect(csv).toBe("a,b\r\n1,2\r\n3,");
  });
});
