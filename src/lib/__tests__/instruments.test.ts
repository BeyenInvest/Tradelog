import { describe, expect, it } from "vitest";
import { distinctInstruments } from "@/lib/instruments";

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
