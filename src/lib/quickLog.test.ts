import { describe, it, expect } from "vitest";
import { tradeSchema } from "@/lib/validation";
import { quickLogDefaults, QUICK_EVALUATIONS } from "./quickLog";

const TODAY = "2026-08-19";

describe("quickLogDefaults", () => {
  it("bare defaults (BE, 0%) already satisfy tradeSchema", () => {
    const r = tradeSchema.safeParse(quickLogDefaults("Fase 1", TODAY));
    expect(r.success).toBe(true);
  });

  it("a win with a positive result validates", () => {
    const values = { ...quickLogDefaults("Fase 1", TODAY), instrument: "ES", resultaat_pct: 2.5, outcome: "Win" };
    expect(tradeSchema.safeParse(values).success).toBe(true);
  });

  it("a loss with a negative result validates", () => {
    const values = { ...quickLogDefaults("Fase 1", TODAY), instrument: "ES", resultaat_pct: -1.2, outcome: "Loss" };
    expect(tradeSchema.safeParse(values).success).toBe(true);
  });

  it("guards a sign/outcome mismatch (win logged as a negative result)", () => {
    const values = { ...quickLogDefaults("Fase 1", TODAY), resultaat_pct: -1, outcome: "Win" };
    expect(tradeSchema.safeParse(values).success).toBe(false);
  });

  it("carries the journal's first fase name through", () => {
    const r = tradeSchema.safeParse(quickLogDefaults("Scalps", TODAY));
    expect(r.success && r.data.fase).toBe("Scalps");
  });
});

describe("QUICK_EVALUATIONS", () => {
  it("never offers 'Missed trade'", () => {
    expect(QUICK_EVALUATIONS).not.toContain("Missed trade");
    expect(QUICK_EVALUATIONS).toContain("Good trade");
  });
});
