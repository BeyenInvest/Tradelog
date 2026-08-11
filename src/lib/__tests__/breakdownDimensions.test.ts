import { describe, expect, it } from "vitest";
import { customFieldDimensions } from "../breakdownDimensions";
import { makeTrade } from "../stats/__tests__/fixtures";
import type { MethodologyField } from "../types";

function field(overrides: Partial<MethodologyField>): MethodologyField {
  return {
    id: overrides.field_key ?? "f",
    methodology_id: "m",
    fase_id: null,
    field_key: "setup",
    label: "Setup",
    field_type: "enum",
    options: null,
    is_computed: false,
    group_label: null,
    required: false,
    show_when_field_id: null,
    show_when_values: null,
    sort_order: 0,
    ...overrides,
  };
}

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
