import { describe, it, expect } from "vitest";
import { tradeSchema } from "../validation";

/** Minimal fields with no schema default — the rest fill in via .default(). */
const base = { fase: "Fase 1", datum_open: "2026-01-01", pair: "EURUSD", cc: "11" } as const;

describe("tradeSchema — open (still-running) trades", () => {
  it("a closed trade requires outcome and resultaat_pct", () => {
    const res = tradeSchema.safeParse({ ...base, is_open: false });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("outcome");
      expect(paths).toContain("resultaat_pct");
    }
  });

  it("a closed trade with outcome + resultaat_pct passes", () => {
    const res = tradeSchema.safeParse({ ...base, is_open: false, outcome: "Win", resultaat_pct: 1.5 });
    expect(res.success).toBe(true);
  });

  it("an open trade passes without outcome or resultaat_pct", () => {
    const res = tradeSchema.safeParse({ ...base, is_open: true });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.is_open).toBe(true);
      expect(res.data.outcome).toBeNull();
      expect(res.data.resultaat_pct).toBeNull();
    }
  });

  it("defaults is_open to false when omitted (a closed trade still needs its result)", () => {
    const res = tradeSchema.safeParse({ ...base });
    expect(res.success).toBe(false); // missing outcome/resultaat on an implicitly-closed trade
  });

  it("the sign guard still applies to a closed trade (Loss must be negative)", () => {
    const res = tradeSchema.safeParse({ ...base, is_open: false, outcome: "Loss", resultaat_pct: 2 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.message === "tradeForm.lossMustBeNegative")).toBe(true);
    }
  });

  it("the sign guard is not evaluated for an open trade", () => {
    const res = tradeSchema.safeParse({ ...base, is_open: true, outcome: "Loss", resultaat_pct: 2 });
    expect(res.success).toBe(true);
  });
});
