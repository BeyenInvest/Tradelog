import { describe, expect, it } from "vitest";
import { normalizeTvSymbol, parseTvSymbol } from "./symbolNormalize";

describe("parseTvSymbol", () => {
  it("splitst exchange-prefix af", () => {
    expect(parseTvSymbol("OANDA:NZDCHF")).toEqual({ exchange: "OANDA", ticker: "NZDCHF" });
  });

  it("werkt zonder prefix en normaliseert casing/whitespace", () => {
    expect(parseTvSymbol("  eurusd ")).toEqual({ exchange: null, ticker: "EURUSD" });
  });

  it("null bij lege input of lege ticker", () => {
    expect(parseTvSymbol("")).toBeNull();
    expect(parseTvSymbol("   ")).toBeNull();
    expect(parseTvSymbol("OANDA:")).toBeNull();
  });
});

describe("normalizeTvSymbol", () => {
  it("herkent een forex-pair met exchange-prefix (S0-fixture)", () => {
    expect(normalizeTvSymbol("OANDA:AUDJPY")).toEqual({
      pair: "AUDJPY",
      instrument: "AUDJPY",
      kind: "forex-pair",
      exchange: "OANDA",
    });
  });

  it("herkent metalen als pair (XAUUSD zit in PAIRS)", () => {
    expect(normalizeTvSymbol("XAUUSD")?.pair).toBe("XAUUSD");
  });

  it("stript een broker-suffix alléén als het restant een bekende pair is", () => {
    expect(normalizeTvSymbol("EURUSD.PRO")?.pair).toBe("EURUSD");
    expect(normalizeTvSymbol("ICMARKETS:EURUSD_SB")?.pair).toBe("EURUSD");
    expect(normalizeTvSymbol("EURUSDM")?.pair).toBe("EURUSD");
    // Onbekend restant → géén strip, gewoon vrij instrument.
    expect(normalizeTvSymbol("ABCXYZ.PRO")).toEqual({
      pair: null,
      instrument: "ABCXYZ.PRO",
      kind: "other",
      exchange: null,
    });
  });

  it("vertaalt continuous futures naar het basissymbool", () => {
    expect(normalizeTvSymbol("CME_MINI:ES1!")).toEqual({
      pair: null,
      instrument: "ES",
      kind: "futures-continuous",
      exchange: "CME_MINI",
    });
    expect(normalizeTvSymbol("NQ2!")?.instrument).toBe("NQ");
  });

  it("laat crypto en indices door als vrij instrument", () => {
    expect(normalizeTvSymbol("BINANCE:BTCUSDT")).toEqual({
      pair: null,
      instrument: "BTCUSDT",
      kind: "other",
      exchange: "BINANCE",
    });
    expect(normalizeTvSymbol("GER40")?.kind).toBe("other");
  });

  it("null bij onbruikbare input", () => {
    expect(normalizeTvSymbol("")).toBeNull();
  });
});
