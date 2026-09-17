import { describe, expect, it } from "vitest";
import {
  directionFromPrices, pipsBetween, plannedRR, positionPrices, realizedR, resultaatPctFromExit,
  tickSize, tickSizeFromFormatted,
} from "./priceMath";

describe("tickSize", () => {
  it("minMove/priceScale — de S0-fixture (AUDJPY: 1/1000)", () => {
    expect(tickSize(1, 1000)).toBe(0.001);
    expect(tickSize(25, 100)).toBe(0.25); // futures-stijl fractie
  });

  it("null bij onbruikbare invoer", () => {
    expect(tickSize(0, 1000)).toBeNull();
    expect(tickSize(1, 0)).toBeNull();
    expect(tickSize(NaN, 100)).toBeNull();
  });
});

describe("tickSizeFromFormatted", () => {
  it("telt decimalen van een geformatteerde prijs", () => {
    expect(tickSizeFromFormatted("1.235")).toBe(0.001);
    expect(tickSizeFromFormatted("110")).toBe(1);
  });

  it("null bij niet-numerieke input (fractie-notaties niet gokken)", () => {
    expect(tickSizeFromFormatted("110'16")).toBeNull();
    expect(tickSizeFromFormatted("")).toBeNull();
  });
});

describe("positionPrices", () => {
  // S0-fixture: long_position, entry 110.33, stopLevel 500, profitLevel 1000, tick 0.001.
  const levels = { entry: 110.33, stopLevelTicks: 500, profitLevelTicks: 1000 };

  it("Long: SL onder entry, TP erboven", () => {
    const p = positionPrices("Long", levels, 0.001);
    expect(p?.stop).toBeCloseTo(109.83, 10);
    expect(p?.target).toBeCloseTo(111.33, 10);
  });

  it("Short: gespiegeld", () => {
    const p = positionPrices("Short", levels, 0.001);
    expect(p?.stop).toBeCloseTo(110.83, 10);
    expect(p?.target).toBeCloseTo(109.33, 10);
  });

  it("null bij ticks ≤ 0 of kapotte invoer", () => {
    expect(positionPrices("Long", { ...levels, stopLevelTicks: 0 }, 0.001)).toBeNull();
    expect(positionPrices("Long", levels, 0)).toBeNull();
  });
});

describe("directionFromPrices", () => {
  it("SL onder entry = Long, erboven = Short, gelijk = null", () => {
    expect(directionFromPrices(110.33, 109.83)).toBe("Long");
    expect(directionFromPrices(110.33, 110.83)).toBe("Short");
    expect(directionFromPrices(110.33, 110.33)).toBeNull();
  });
});

describe("plannedRR", () => {
  it("S0-fixture geeft R:R 2", () => {
    expect(plannedRR(110.33, 109.83, 111.33)).toBe(2);
  });

  it("rondt op 2 decimalen af", () => {
    expect(plannedRR(100, 99, 101.333)).toBe(1.33);
  });

  it("null bij stop op entry", () => {
    expect(plannedRR(100, 100, 102)).toBeNull();
  });
});

describe("pipsBetween", () => {
  it("JPY-pip 0.01: entry→SL van de fixture = 50 pips", () => {
    expect(pipsBetween(110.33, 109.83, 0.01)).toBe(50);
  });

  it("rondt op 1 decimaal, null bij pipSize ≤ 0", () => {
    expect(pipsBetween(1.10005, 1.1, 0.0001)).toBe(0.5);
    expect(pipsBetween(1, 2, 0)).toBeNull();
  });
});

describe("realizedR", () => {
  it("S0-fixture: Long 110.33/SL 109.83, exit op de TP = +2R; exit op de SL = -1R", () => {
    expect(realizedR("Long", 110.33, 109.83, 111.33)).toBeCloseTo(2, 10);
    expect(realizedR("Long", 110.33, 109.83, 109.83)).toBeCloseTo(-1, 10);
  });

  it("Short gespiegeld: winst onder entry, verlies erboven", () => {
    expect(realizedR("Short", 110.33, 110.83, 109.33)).toBeCloseTo(2, 10);
    expect(realizedR("Short", 110.33, 110.83, 110.83)).toBeCloseTo(-1, 10);
  });

  it("weigert richting-inconsistentie en stop op entry (geen stille correctie)", () => {
    expect(realizedR("Short", 110.33, 109.83, 111.33)).toBeNull(); // SL onder entry = Long
    expect(realizedR("Long", 110.33, 110.33, 111.33)).toBeNull();
  });

  it("weigert een onbruikbare exit (≤ 0, NaN — DB-check prices_positive)", () => {
    expect(realizedR("Long", 110.33, 109.83, 0)).toBeNull();
    expect(realizedR("Long", 110.33, 109.83, Number.NaN)).toBeNull();
  });
});

describe("resultaatPctFromExit", () => {
  it("R × risk%, afgerond op 2 decimalen (numeric(7,2))", () => {
    expect(resultaatPctFromExit("Long", 110.33, 109.83, 111.33, 1)).toBe(2);
    expect(resultaatPctFromExit("Long", 110.33, 109.83, 111.33, 0.5)).toBe(1);
    expect(resultaatPctFromExit("Long", 100, 99, 101.333, 1)).toBe(1.33);
  });

  it("lege risk_pct volgt de app-brede 1%-default (R ≡ resultaat_pct)", () => {
    expect(resultaatPctFromExit("Long", 110.33, 109.83, 111.33, null)).toBe(2);
    expect(resultaatPctFromExit("Long", 110.33, 109.83, 111.33, 0)).toBe(2); // niet-positief = default
  });

  it("exit exact op entry is 0, nooit -0 (round2-conventie)", () => {
    expect(Object.is(resultaatPctFromExit("Short", 110.33, 110.83, 110.33, 1), 0)).toBe(true);
  });

  it("degradeert mee met realizedR", () => {
    expect(resultaatPctFromExit("Short", 110.33, 109.83, 111.33, 1)).toBeNull();
  });
});
