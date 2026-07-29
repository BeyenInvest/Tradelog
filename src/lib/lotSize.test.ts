import { describe, it, expect } from "vitest";
import { calculateLotSize, pipSizeOf, requiresCrossRate, requiresCurrentPrice, getConversionCase } from "./lotSize";

describe("pipSizeOf", () => {
  it("is 0.01 for JPY-quoted pairs", () => {
    expect(pipSizeOf("USDJPY")).toBe(0.01);
    expect(pipSizeOf("GBPJPY")).toBe(0.01);
    expect(pipSizeOf("EURJPY")).toBe(0.01);
  });
  it("is 0.0001 for every other pair", () => {
    expect(pipSizeOf("EURUSD")).toBe(0.0001);
    expect(pipSizeOf("AUDCAD")).toBe(0.0001);
    expect(pipSizeOf("EURGBP")).toBe(0.0001);
  });
});

describe("getConversionCase", () => {
  it("is 'direct' when the account currency is the quote currency", () => {
    expect(getConversionCase("EURUSD", "USD")).toBe("direct");
  });
  it("is 'inverse' when the account currency is the base currency", () => {
    expect(getConversionCase("USDJPY", "USD")).toBe("inverse");
  });
  it("is 'cross' when the account currency is neither base nor quote", () => {
    expect(getConversionCase("GBPUSD", "EUR")).toBe("cross");
    expect(getConversionCase("EURGBP", "USD")).toBe("cross");
  });
});

describe("requiresCurrentPrice", () => {
  it("is false for the direct case — no price needed at all", () => {
    expect(requiresCurrentPrice("EURUSD", "USD")).toBe(false);
    expect(requiresCurrentPrice("GBPUSD", "USD")).toBe(false);
    expect(requiresCurrentPrice("AUDUSD", "USD")).toBe(false);
  });
  it("is true only for the inverse case", () => {
    expect(requiresCurrentPrice("USDJPY", "USD")).toBe(true);
    expect(requiresCurrentPrice("EURGBP", "EUR")).toBe(true);
  });
  it("is false for the cross case (uses quoteToAccountRate instead)", () => {
    expect(requiresCurrentPrice("GBPUSD", "EUR")).toBe(false);
  });
});

describe("requiresCrossRate", () => {
  it("is false when the account currency is the quote currency", () => {
    expect(requiresCrossRate("EURUSD", "USD")).toBe(false);
  });
  it("is false when the account currency is the base currency", () => {
    expect(requiresCrossRate("USDJPY", "USD")).toBe(false);
  });
  it("is true when the account currency is neither base nor quote", () => {
    expect(requiresCrossRate("GBPUSD", "EUR")).toBe(true);
    expect(requiresCrossRate("EURGBP", "USD")).toBe(true);
  });
  it("is false when the account currency is the base currency (inverse case)", () => {
    expect(requiresCrossRate("EURGBP", "EUR")).toBe(false);
  });
});

describe("calculateLotSize — direct case (account currency = quote currency)", () => {
  it("EURUSD, USD account: matches a hand-computed result, no currentPrice supplied at all", () => {
    // Mirrors what a trader sees on myfxbook: for USD-account + XXXUSD pairs,
    // no price input is asked for — the pip value is already in USD.
    const outcome = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "EURUSD",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected ok");
    // riskAmount = 100, pipValue/lot = 0.0001*100000 = 10, lots = 100/(20*10) = 0.5
    expect(outcome.result.conversionCase).toBe("direct");
    expect(outcome.result.riskAmount).toBe(100);
    expect(outcome.result.pipValuePerLot).toBe(10);
    expect(outcome.result.lots).toBe(0.5);
    expect(outcome.result.units).toBe(50_000);
  });

  it("ignores an accidentally-supplied currentPrice in the direct case (it's simply unused)", () => {
    const withPrice = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "EURUSD",
      currentPrice: 999, // deliberately absurd — must have zero effect
    });
    const withoutPrice = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "EURUSD",
    });
    expect(withPrice).toEqual(withoutPrice);
  });
});

describe("calculateLotSize — inverse case (account currency = base currency)", () => {
  it("USDJPY, USD account: matches a hand-computed result (JPY pip size)", () => {
    const outcome = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "USDJPY",
      currentPrice: 150,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected ok");
    // pipValue/lot (JPY) = 0.01*100000 = 1000; in USD = 1000/150 = 6.6667
    // riskAmount=100; lots = 100/(20*6.6667) = 0.75 exactly (100*150/(20*1000))
    expect(outcome.result.conversionCase).toBe("inverse");
    expect(outcome.result.lots).toBe(0.75);
    expect(outcome.result.units).toBe(75_000);
  });

  it("fails validation when currentPrice is missing for an inverse pair", () => {
    const outcome = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "USDJPY",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.errors.some((e) => e.field === "currentPrice")).toBe(true);
  });
});

describe("calculateLotSize — cross case (account currency is neither base nor quote)", () => {
  it("GBPUSD, EUR account: requires and correctly applies quoteToAccountRate", () => {
    const outcome = calculateLotSize({
      accountCurrency: "EUR",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "GBPUSD",
      quoteToAccountRate: 1 / 1.1, // "1 USD = 0.909... EUR" (derived from EURUSD=1.10)
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected ok");
    // pipValue/lot (USD) = 10; in EUR = 10 * (1/1.1) = 9.0909...
    // riskAmount = 100; lots = 100/(20*9.0909) = 0.55 exactly (100*1.1/(20*10))
    expect(outcome.result.conversionCase).toBe("cross");
    expect(outcome.result.lots).toBe(0.55);
    expect(outcome.result.units).toBe(55_000);
  });

  it("fails validation when quoteToAccountRate is missing for a true cross pair", () => {
    const outcome = calculateLotSize({
      accountCurrency: "EUR",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "GBPUSD",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.errors.some((e) => e.field === "quoteToAccountRate")).toBe(true);
  });

  it("does NOT require quoteToAccountRate when EUR is the pair's base currency (inverse instead)", () => {
    const outcome = calculateLotSize({
      accountCurrency: "EUR",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "EURGBP",
      currentPrice: 0.86,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected ok");
    expect(outcome.result.conversionCase).toBe("inverse");
  });
});

describe("calculateLotSize — validation", () => {
  const validDirect = {
    accountCurrency: "USD" as const,
    accountBalance: 10_000,
    riskPercent: 1,
    stopLossPips: 20,
    pair: "EURUSD" as const,
  };

  it("rejects zero/negative accountBalance", () => {
    const outcome = calculateLotSize({ ...validDirect, accountBalance: 0 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.errors.map((e) => e.field)).toContain("accountBalance");
  });

  it("rejects zero/negative riskPercent", () => {
    const outcome = calculateLotSize({ ...validDirect, riskPercent: -1 });
    expect(outcome.ok).toBe(false);
  });

  it("rejects zero/negative stopLossPips", () => {
    const outcome = calculateLotSize({ ...validDirect, stopLossPips: 0 });
    expect(outcome.ok).toBe(false);
  });

  it("rejects zero/negative currentPrice when it's actually required (inverse case)", () => {
    const outcome = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 10_000,
      riskPercent: 1,
      stopLossPips: 20,
      pair: "USDJPY",
      currentPrice: 0,
    });
    expect(outcome.ok).toBe(false);
  });

  it("accumulates every invalid field in one call rather than stopping at the first", () => {
    const outcome = calculateLotSize({
      accountCurrency: "USD",
      accountBalance: 0,
      riskPercent: 0,
      stopLossPips: 0,
      pair: "USDJPY", // inverse case, so currentPrice is also required here
      currentPrice: 0,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.errors).toHaveLength(4);
  });

  it("never returns ok:true together with errors, and never ok:false without any", () => {
    const ok = calculateLotSize(validDirect);
    const bad = calculateLotSize({ ...validDirect, accountBalance: -5 });
    expect(ok.ok && !("errors" in ok)).toBe(true);
    expect(!bad.ok && bad.errors.length > 0).toBe(true);
  });
});
