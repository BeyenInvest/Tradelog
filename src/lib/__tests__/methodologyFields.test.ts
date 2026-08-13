import { describe, expect, it } from "vitest";
import {
  dynamicMethodologyFields,
  isFieldVisible,
  isLockedLegacyField,
  missingRequiredCustomFields,
  parseFieldOptions,
  slugifyFieldKey,
} from "../methodologyFields";
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

describe("dynamicMethodologyFields / isLockedLegacyField", () => {
  it("excludes seeded legacy keys only on a legacy (WPM) journal", () => {
    const wpm = [
      field({ field_key: "fase", options: ["Fase 1"] }),
      field({ field_key: "structuur", options: ["Inner"] }),
      field({ field_key: "setup", options: ["A"] }),
    ];
    expect(dynamicMethodologyFields(wpm).map((f) => f.field_key)).toEqual(["setup"]);
    expect(isLockedLegacyField(wpm[0], wpm)).toBe(true);
    expect(isLockedLegacyField(wpm[2], wpm)).toBe(false);
  });

  it("keeps user fields with legacy-looking keys on a non-WPM journal (no phantom fields)", () => {
    // A stocks/crypto journal has no `fase` field; "Engulfing candle" / "Structuur"
    // are then ordinary user fields and must render + get breakdowns.
    const own = [
      field({ field_key: "engulfing_candle", field_type: "boolean" }),
      field({ field_key: "structuur", options: ["Inner", "Outer"] }),
    ];
    expect(dynamicMethodologyFields(own).map((f) => f.field_key)).toEqual(["engulfing_candle", "structuur"]);
    expect(isLockedLegacyField(own[0], own)).toBe(false);
  });

  it("always excludes computed fields", () => {
    const fields = [field({ field_key: "beide", is_computed: true })];
    expect(dynamicMethodologyFields(fields)).toEqual([]);
  });
});

describe("isFieldVisible", () => {
  const parent = field({ field_key: "setup", options: ["A", "B"] });
  const child = field({ field_key: "detail", show_when_field_id: "setup", show_when_values: ["A"] });

  it("honours show_when against the custom bag, and against fase for the legacy parent", () => {
    expect(isFieldVisible(child, [parent, child], null, { setup: "A" })).toBe(true);
    expect(isFieldVisible(child, [parent, child], null, { setup: "B" })).toBe(false);
    expect(isFieldVisible(child, [parent, child], null, {})).toBe(false);

    const faseParent = field({ field_key: "fase", options: ["Fase 1", "Fase 2"] });
    const faseChild = field({ field_key: "detail", show_when_field_id: "fase", show_when_values: ["Fase 2"] });
    expect(isFieldVisible(faseChild, [faseParent, faseChild], "Fase 2", {})).toBe(true);
    expect(isFieldVisible(faseChild, [faseParent, faseChild], "Fase 1", {})).toBe(false);
  });

  it("shows a field whose condition parent no longer exists", () => {
    expect(isFieldVisible(child, [child], null, {})).toBe(true);
  });
});

describe("missingRequiredCustomFields", () => {
  const setup = field({ field_key: "setup", options: ["A", "B"], required: true });
  const note = field({ field_key: "note", field_type: "text", required: false });
  const confirmed = field({ field_key: "confirmed", field_type: "boolean", required: true });

  it("flags visible required fields that are blank ('' / null / NaN), not answered ones (false counts as answered)", () => {
    expect(missingRequiredCustomFields([setup, note, confirmed], null, {}).map((f) => f.field_key)).toEqual([
      "setup",
      "confirmed",
    ]);
    expect(
      missingRequiredCustomFields([setup, note, confirmed], null, { setup: "", confirmed: false }).map(
        (f) => f.field_key
      )
    ).toEqual(["setup"]);
    expect(missingRequiredCustomFields([setup, confirmed], null, { setup: "A", confirmed: false })).toEqual([]);
    const rr = field({ field_key: "rr", field_type: "number", required: true });
    expect(missingRequiredCustomFields([rr], null, { rr: NaN }).map((f) => f.field_key)).toEqual(["rr"]);
    expect(missingRequiredCustomFields([rr], null, { rr: 0 })).toEqual([]);
  });

  it("never requires a field its condition currently hides", () => {
    const conditional = field({
      field_key: "detail",
      required: true,
      show_when_field_id: "setup",
      show_when_values: ["A"],
    });
    // setup answered with "B" → detail is hidden → nothing missing.
    expect(missingRequiredCustomFields([setup, conditional], null, { setup: "B" })).toEqual([]);
    // setup answered with "A" → detail is visible and blank → flagged.
    expect(missingRequiredCustomFields([setup, conditional], null, { setup: "A" }).map((f) => f.field_key)).toEqual([
      "detail",
    ]);
  });
});

describe("slugifyFieldKey", () => {
  it("lowercases and collapses separators/punctuation to single underscores", () => {
    expect(slugifyFieldKey("Sessie mood")).toBe("sessie_mood");
    expect(slugifyFieldKey("  Risk/Reward %! ")).toBe("risk_reward");
  });

  it("falls back to 'veld' when nothing usable remains and caps at 40 chars", () => {
    expect(slugifyFieldKey("!!!")).toBe("veld");
    expect(slugifyFieldKey("x".repeat(60))).toHaveLength(40);
  });
});

describe("parseFieldOptions", () => {
  it("splits on commas/newlines, trims, and de-duplicates case-insensitively", () => {
    expect(parseFieldOptions(" Reversal, continuation\nREVERSAL, , Breakout ")).toEqual([
      "Reversal",
      "continuation",
      "Breakout",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseFieldOptions("  ,  \n ")).toEqual([]);
  });
});
