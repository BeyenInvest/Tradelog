import { describe, it, expect } from "vitest";
import { tradeSchema } from "@/lib/validation";
import { quickLogDefaults, QUICK_EVALUATIONS } from "./quickLog";

const TODAY = "2026-08-19";

describe("quickLogDefaults", () => {
  it("bare defaults (BE, 0%) already satisfy tradeSchema", () => {
    const r = tradeSchema.safeParse(quickLogDefaults(TODAY));
    expect(r.success).toBe(true);
  });

  it("a win with a positive result validates", () => {
    const values = { ...quickLogDefaults(TODAY), instrument: "ES", resultaat_pct: 2.5, outcome: "Win" };
    expect(tradeSchema.safeParse(values).success).toBe(true);
  });

  it("a loss with a negative result validates", () => {
    const values = { ...quickLogDefaults(TODAY), instrument: "ES", resultaat_pct: -1.2, outcome: "Loss" };
    expect(tradeSchema.safeParse(values).success).toBe(true);
  });

  it("guards a sign/outcome mismatch (win logged as a negative result)", () => {
    const values = { ...quickLogDefaults(TODAY), resultaat_pct: -1, outcome: "Win" };
    expect(tradeSchema.safeParse(values).success).toBe(false);
  });

  it("starts with an empty custom bag (methodology fields left unset)", () => {
    expect(quickLogDefaults(TODAY).custom).toEqual({});
  });
});

describe("QUICK_EVALUATIONS", () => {
  it("never offers 'Missed trade'", () => {
    expect(QUICK_EVALUATIONS).not.toContain("Missed trade");
    expect(QUICK_EVALUATIONS).toContain("Good trade");
  });
});
