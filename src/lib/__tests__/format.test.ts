import { describe, it, expect } from "vitest";
import {
  formatEUR,
  resultDisplayValue,
  resultUnitSuffix,
  pctToAmount,
  resultInUnit,
  groupResultCtx,
  tradesInResultUnit,
  formatAggregate,
  formatResult,
  formatProfitFactor,
  dateLocale,
  monthName,
} from "../format";
import { makeTrade } from "../stats/__tests__/fixtures";

describe("formatEUR", () => {
  it("formats with nl-BE grouping and two decimals", () => {
    expect(formatEUR(1234.5)).toBe("1.234,50");
    expect(formatEUR(0)).toBe("0,00");
  });
});

describe("resultDisplayValue", () => {
  it("returns the pct in percent mode", () => {
    expect(resultDisplayValue(1.5, "percent")).toBe(1.5);
  });

  it("returns the R-multiple in R mode when provided", () => {
    expect(resultDisplayValue(3, "R", { rMultiple: 1.5 })).toBe(1.5);
  });

  it("falls back to pct when R mode has no rMultiple (honest fallback)", () => {
    expect(resultDisplayValue(3, "R")).toBe(3);
  });

  it("returns the amount in currency mode, falling back to pct without one", () => {
    expect(resultDisplayValue(2, "currency", { amount: 250 })).toBe(250);
    expect(resultDisplayValue(2, "currency")).toBe(2);
  });
});

describe("resultUnitSuffix", () => {
  it("is R for R mode, % otherwise", () => {
    expect(resultUnitSuffix("R")).toBe("R");
    expect(resultUnitSuffix("percent")).toBe("%");
    expect(resultUnitSuffix("currency")).toBe("%");
  });
});

describe("pctToAmount", () => {
  it("is pct/100 × saldo, undefined without saldo", () => {
    expect(pctToAmount(2, 10000)).toBe(200);
    expect(pctToAmount(2, null)).toBeUndefined();
    expect(pctToAmount(2, undefined)).toBeUndefined();
  });
});

describe("resultInUnit", () => {
  it("percent passes the pct through", () => {
    expect(resultInUnit(makeTrade({ resultaat_pct: 1.5 }), "percent")).toBe(1.5);
  });

  it("R divides by the planned risk (null risk = 1% default)", () => {
    expect(resultInUnit(makeTrade({ resultaat_pct: 3, risk_pct: 2 }), "R")).toBe(1.5);
    expect(resultInUnit(makeTrade({ resultaat_pct: 3, risk_pct: null }), "R")).toBe(3);
  });

  it("currency converts via saldo, falling back to pct without one", () => {
    expect(resultInUnit(makeTrade({ resultaat_pct: 2 }), "currency", 10000)).toBe(200);
    expect(resultInUnit(makeTrade({ resultaat_pct: 2 }), "currency", null)).toBe(2);
  });
});

describe("tradesInResultUnit", () => {
  it("percent returns the list untouched (same reference)", () => {
    const trades = [makeTrade({ resultaat_pct: 2 })];
    expect(tradesInResultUnit(trades, "percent")).toBe(trades);
  });

  it("R replaces resultaat_pct with the unrounded R-ratio", () => {
    const [converted] = tradesInResultUnit([makeTrade({ resultaat_pct: 1, risk_pct: 3 })], "R");
    expect(converted.resultaat_pct).toBe(1 / 3); // unrounded — sum-then-round order preserved
  });

  it("currency without saldo stays unconverted", () => {
    const trades = [makeTrade({ resultaat_pct: 2 })];
    expect(tradesInResultUnit(trades, "currency", null)).toBe(trades);
    expect(tradesInResultUnit(trades, "currency", 10000)[0].resultaat_pct).toBe(200);
  });
});

describe("groupResultCtx", () => {
  it("R mode: totalR over closed taken trades only (missed/open excluded)", () => {
    const trades = [
      makeTrade({ resultaat_pct: 2, risk_pct: 1 }),
      makeTrade({ resultaat_pct: 5, outcome: "Win", trade_evaluation: "Missed trade" }),
      makeTrade({ is_open: true }),
    ];
    expect(groupResultCtx(trades, 2, "R", null)).toEqual({ rMultiple: 2 });
  });

  it("currency mode: amount from the total pct and saldo", () => {
    expect(groupResultCtx([], 2, "currency", 10000)).toEqual({ amount: 200 });
  });

  it("percent mode: empty ctx", () => {
    expect(groupResultCtx([], 2, "percent", null)).toEqual({});
  });
});

describe("formatAggregate", () => {
  it("formats % and R with an explicit + for gains", () => {
    expect(formatAggregate(1.1, "percent")).toBe("+1.1%");
    expect(formatAggregate(-0.5, "R")).toBe("-0.5R");
    expect(formatAggregate(0, "percent")).toBe("0%");
  });

  it("forces fixed decimals when asked (compact calendar cells)", () => {
    expect(formatAggregate(1, "percent", { decimals: 1 })).toBe("+1.0%");
  });

  it("normalizes float dust to a clean 0 instead of '-0.0'", () => {
    expect(formatAggregate(0.3 - 0.2 - 0.1, "R", { decimals: 1 })).toBe("0.0R");
    expect(formatAggregate(-0.0001, "percent")).toBe("0%");
  });

  it("currency uses nl-BE grouping with a sign before the € symbol", () => {
    expect(formatAggregate(1234.5, "currency")).toBe("+€1.234,50");
    expect(formatAggregate(-1234.5, "currency")).toBe("-€1.234,50");
    expect(formatAggregate(12500, "currency", { decimals: 0 })).toBe("+€12.500");
  });
});

describe("formatResult", () => {
  it("percent: pct with a + for gains", () => {
    expect(formatResult(1.1, "percent")).toBe("+1.1%");
    expect(formatResult(-2, "percent")).toBe("-2%");
  });

  it("R: two decimals with suffix, falling back to % without an rMultiple", () => {
    expect(formatResult(3, "R", { rMultiple: 1.5 })).toBe("+1.50R");
    expect(formatResult(3, "R")).toBe("+3%");
  });

  it("currency: EUR formatting, falling back to % without an amount", () => {
    expect(formatResult(2, "currency", { amount: 250 })).toBe("+€250,00");
    expect(formatResult(2, "currency")).toBe("+2%");
  });
});

describe("formatProfitFactor", () => {
  it("— for null, ∞ for Infinity, two decimals otherwise", () => {
    expect(formatProfitFactor(null)).toBe("—");
    expect(formatProfitFactor(Infinity)).toBe("∞");
    expect(formatProfitFactor(1.5)).toBe("1.50");
  });
});

describe("dateLocale / monthName", () => {
  it("follows the active UI language", () => {
    expect(dateLocale("nl")).toBe("nl-BE");
    expect(dateLocale("nl-BE")).toBe("nl-BE");
    expect(dateLocale("en")).toBe("en-GB");
  });

  it("localizes the month name", () => {
    expect(monthName(0, "en-GB")).toBe("January");
    expect(monthName(6, "nl-BE")).toBe("juli");
  });
});
