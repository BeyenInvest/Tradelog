import { describe, expect, it } from "vitest";
import { distinctInstruments, instrumentsOfConfig, normalizeInstrument } from "@/lib/instruments";

describe("distinctInstruments", () => {
  it("dedupes and sorts alphabetically", () => {
    expect(
      distinctInstruments([
        { instrument: "TSLA" },
        { instrument: "AAPL" },
        { instrument: "TSLA" },
        { instrument: "BTC" },
      ])
    ).toEqual(["AAPL", "BTC", "TSLA"]);
  });

  it("drops nulls, empty strings and whitespace-only values", () => {
    expect(
      distinctInstruments([
        { instrument: null },
        { instrument: "" },
        { instrument: "   " },
        { instrument: "ES" },
      ])
    ).toEqual(["ES"]);
  });

  it("trims surrounding whitespace and dedupes across trimmed forms", () => {
    expect(distinctInstruments([{ instrument: " NQ " }, { instrument: "NQ" }])).toEqual(["NQ"]);
  });

  it("returns an empty array for no rows", () => {
    expect(distinctInstruments([])).toEqual([]);
  });
});

describe("normalizeInstrument", () => {
  it("trims, collapses whitespace and uppercases", () => {
    expect(normalizeInstrument("  es ")).toBe("ES");
    expect(normalizeInstrument("mes")).toBe("MES");
    expect(normalizeInstrument("us  30")).toBe("US 30");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeInstrument("   ")).toBe("");
    expect(normalizeInstrument("")).toBe("");
  });
});

describe("instrumentsOfConfig", () => {
  it("reads, normalizes, dedupes and sorts the instruments array", () => {
    expect(instrumentsOfConfig({ instruments: ["nq", "ES", "es", " NQ "] })).toEqual(["ES", "NQ"]);
  });

  it("falls back to tick_values keys when no instruments array is set", () => {
    expect(instrumentsOfConfig({ unit: "contracts", tick_values: { ES: 12.5, NQ: 5, MES: 1.25 } })).toEqual([
      "ES",
      "MES",
      "NQ",
    ]);
  });

  it("prefers a non-empty instruments array over tick_values, but still seeds from tick_values while the list is empty", () => {
    expect(instrumentsOfConfig({ instruments: ["CL"], tick_values: { ES: 12.5 } })).toEqual(["CL"]);
    expect(instrumentsOfConfig({ instruments: [], tick_values: { ES: 12.5 } })).toEqual(["ES"]);
  });

  it("returns an empty array for null/empty config", () => {
    expect(instrumentsOfConfig(null)).toEqual([]);
    expect(instrumentsOfConfig({})).toEqual([]);
    expect(instrumentsOfConfig({ unit: "shares" })).toEqual([]);
  });
});
