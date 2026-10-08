import { describe, expect, it } from "vitest";
import { hasOwnFields, STANDARD_FIELD_KEYS } from "./methodologyFields";

describe("hasOwnFields — standaardvelden (0068)", () => {
  it("een journal met alleen Scale-in telt nog als leeg (preset-kiezer blijft)", () => {
    expect(STANDARD_FIELD_KEYS).toContain("scale_in");
    expect(hasOwnFields([])).toBe(false);
    expect(hasOwnFields([{ field_key: "scale_in" }])).toBe(false);
  });

  it("één eigen veld naast Scale-in = geconfigureerd", () => {
    expect(hasOwnFields([{ field_key: "scale_in" }, { field_key: "setup" }])).toBe(true);
    expect(hasOwnFields([{ field_key: "fase" }])).toBe(true);
  });
});
