import { describe, expect, it } from "vitest";
import { BREAKDOWN_DIMENSIONS, breakdownDimensionsFor, customFieldDimensions } from "../breakdownDimensions";
import { makeTrade } from "../stats/__tests__/fixtures";
import type { MethodologyField } from "../types";

function field(overrides: Partial<MethodologyField>): MethodologyField {
  return {
    id: overrides.field_key ?? "f",
    methodology_id: "m",
    fase_id: null,
    field_key: "setup",
    label: "Setup",
    label_key: null,
    field_type: "enum",
    options: null,
    is_computed: false,
    group_label: null,
    group_key: null,
    required: false,
    show_when_field_id: null,
    show_when_values: null,
    sort_order: 0,
    ...overrides,
  };
}

describe("uur dimension (0051 — hour of tijd_open)", () => {
  const uur = BREAKDOWN_DIMENSIONS.find((d) => d.id === "uur")!;

  it("buckets on the wall-clock hour and drops trades without a time", () => {
    expect(uur.keyFn(makeTrade({ tijd_open: "09:45:00" }))).toBe("09");
    expect(uur.keyFn(makeTrade({ tijd_open: "14:05" }))).toBe("14");
    expect(uur.keyFn(makeTrade({ tijd_open: null }))).toBeNull();
  });

  it("is universal and calendar-derived (shown everywhere, skipped by adherence)", () => {
    expect(uur.universal).toBe(true);
    expect(uur.dateDerived).toBe(true);
  });
});

describe("breakdownDimensionsFor (0051 — journal-type-aware sessie)", () => {
  it("keeps the cc-based sessie untouched on the legacy WPM journal", () => {
    const sessie = breakdownDimensionsFor(true).find((d) => d.id === "sessie")!;
    // cc-based: every trade has a valid sessie, time or no time.
    expect(sessie.keyFn(makeTrade({ tijd_open: null, sessie: "New York" }))).toBe("New York");
    expect(sessie.universal).toBeUndefined();
  });

  it("swaps in the time-based sessie for any other journal, in the same list position", () => {
    const dims = breakdownDimensionsFor(false);
    expect(dims.map((d) => d.id)).toEqual(BREAKDOWN_DIMENSIONS.map((d) => d.id));
    const sessie = dims.find((d) => d.id === "sessie")!;
    // Without tijd_open the stored sessie comes from the hidden cc default → must drop out.
    expect(sessie.keyFn(makeTrade({ tijd_open: null, sessie: "London" }))).toBeNull();
    expect(sessie.keyFn(makeTrade({ tijd_open: "22:10:00", sessie: "New York" }))).toBe("New York");
    expect(sessie.universal).toBe(true);
  });
});

describe("customFieldDimensions", () => {
  it("keeps only analysable custom fields, dropping legacy, computed, text, date, and number-without-data", () => {
    const fields = [
      field({ field_key: "setup", field_type: "enum", options: ["A", "B"] }),
      field({ field_key: "news", field_type: "boolean" }),
      field({ field_key: "fase", field_type: "enum", options: ["Fase 1"] }), // legacy
      field({ field_key: "structuur", field_type: "enum", options: ["Inner"] }), // legacy
      field({ field_key: "beide", field_type: "boolean", is_computed: true }), // computed
      field({ field_key: "targets", field_type: "text" }), // not bucketable
      field({ field_key: "leverage", field_type: "number" }), // number, but no trades → no data → dropped
    ];
    const dims = customFieldDimensions(fields);
    expect(dims.map((d) => d.id)).toEqual(["custom:setup", "custom:news"]);
    expect(dims[0].label).toBe("Setup");
    expect(dims[0].sortOrder).toEqual(["A", "B"]);
  });

  it("keeps user fields with legacy-looking keys on a non-WPM journal (no fase field present)", () => {
    // Without a seeded `fase` field this is not a legacy journal, so "structuur" /
    // "engulfing_candle" are ordinary user fields that must get a breakdown.
    const dims = customFieldDimensions([
      field({ field_key: "structuur", field_type: "enum", options: ["Inner", "Outer"] }),
      field({ field_key: "engulfing_candle", field_type: "boolean" }),
    ]);
    expect(dims.map((d) => d.id)).toEqual(["custom:structuur", "custom:engulfing_candle"]);
  });

  it("adds a quartile-bucketed dimension for a number field once trades carry values", () => {
    const fields = [field({ field_key: "rr", label: "R:R", field_type: "number" })];
    // Few distinct values → one bucket per exact value, in ascending order.
    const trades = [1, 2, 2, 3, 1].map((rr) => makeTrade({ custom: { rr } }));
    const [dim] = customFieldDimensions(fields, trades);
    expect(dim.id).toBe("custom:rr");
    expect(dim.label).toBe("R:R");
    expect(dim.sortOrder).toEqual(["1", "2", "3"]);
    expect(dim.keyFn(makeTrade({ custom: { rr: 2 } }))).toBe("2");
    expect(dim.keyFn(makeTrade({ custom: {} }))).toBeNull();
    expect(dim.keyFn(makeTrade({ custom: { rr: "n/a" } }))).toBeNull();
  });

  it("reads the value out of the trades.custom bag, mapping booleans to Ja/Nee and blanks to null", () => {
    const [setupDim, newsDim] = customFieldDimensions([
      field({ field_key: "setup", field_type: "enum", options: ["A", "B"] }),
      field({ field_key: "news", field_type: "boolean" }),
    ]);

    expect(setupDim.keyFn(makeTrade({ custom: { setup: "A" } }))).toBe("A");
    expect(setupDim.keyFn(makeTrade({ custom: {} }))).toBeNull();
    expect(setupDim.keyFn(makeTrade({ custom: { setup: "" } }))).toBeNull();
    expect(newsDim.keyFn(makeTrade({ custom: { news: true } }))).toBe("Ja");
    expect(newsDim.keyFn(makeTrade({ custom: { news: false } }))).toBe("Nee");
    expect(newsDim.keyFn(makeTrade({ custom: {} }))).toBeNull();
  });
});
