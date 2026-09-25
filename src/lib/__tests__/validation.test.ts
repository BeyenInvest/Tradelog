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

// G3 (deep review 2026-09-17): the remaining superRefine rules + the ""→null
// preprocessing layer. Every message here is an i18n key resolved at render —
// the parity test (src/i18n/__tests__/parity.test.ts) guards their existence.
const closed = { ...base, is_open: false, outcome: "Win", resultaat_pct: 1.5 } as const;

function messagesOf(input: Record<string, unknown>): string[] {
  const res = tradeSchema.safeParse(input);
  return res.success ? [] : res.error.issues.map((i) => i.message);
}

describe("tradeSchema — superRefine rules (G3)", () => {
  it("a Win logged with a negative % fails (winMustBePositive)", () => {
    expect(messagesOf({ ...closed, resultaat_pct: -1 })).toContain("tradeForm.winMustBePositive");
  });

  it("closing before opening fails; same-day close passes (closeBeforeOpen)", () => {
    expect(messagesOf({ ...closed, datum_sluiting: "2025-12-31" })).toContain("tradeForm.closeBeforeOpen");
    expect(messagesOf({ ...closed, datum_sluiting: "2026-01-01" })).toEqual([]);
    expect(messagesOf({ ...closed, datum_sluiting: "2026-01-05" })).toEqual([]);
  });

  it("MAE/MFE are magnitudes — a negative entry is the classic sign mistake", () => {
    expect(messagesOf({ ...closed, mae_pct: -0.5 })).toContain("tradeForm.excursionMustBePositive");
    expect(messagesOf({ ...closed, mfe_pct: -2 })).toContain("tradeForm.excursionMustBePositive");
    expect(messagesOf({ ...closed, mae_pct: 0.5, mfe_pct: 2 })).toEqual([]);
    expect(messagesOf({ ...closed, mae_pct: 0 })).toEqual([]); // zero excursion is valid
  });

  it("planned_rr must be strictly positive", () => {
    expect(messagesOf({ ...closed, planned_rr: 0 })).toContain("tradeForm.riskMustBePositive");
    expect(messagesOf({ ...closed, planned_rr: -2 })).toContain("tradeForm.riskMustBePositive");
    expect(messagesOf({ ...closed, planned_rr: 2 })).toEqual([]);
  });

  it("risk_pct must be strictly positive when entered; null means the default 1%", () => {
    expect(messagesOf({ ...closed, risk_pct: 0 })).toContain("tradeForm.riskMustBePositive");
    expect(messagesOf({ ...closed, risk_pct: -1 })).toContain("tradeForm.riskMustBePositive");
    expect(messagesOf({ ...closed, risk_pct: null })).toEqual([]);
  });
});

describe('tradeSchema — ""→null preprocessing (G3)', () => {
  it('empty number inputs become null, not 0 (z.coerce alone would give 0)', () => {
    const res = tradeSchema.safeParse({ ...base, is_open: true, resultaat_pct: "", risk_pct: "", mae_pct: "" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.resultaat_pct).toBeNull();
      expect(res.data.risk_pct).toBeNull();
      expect(res.data.mae_pct).toBeNull();
    }
  });

  it("filled number inputs still coerce from string", () => {
    const res = tradeSchema.safeParse({ ...closed, resultaat_pct: "1.5", risk_pct: "0.5" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.resultaat_pct).toBe(1.5);
      expect(res.data.risk_pct).toBe(0.5);
    }
  });

  it('an empty <input type="date"> ("") becomes null, not an invalid empty date', () => {
    const res = tradeSchema.safeParse({ ...closed, datum_sluiting: "" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.datum_sluiting).toBeNull();
  });

  it('an unselected <select> ("") becomes null instead of failing the enum', () => {
    const res = tradeSchema.safeParse({ ...closed, direction: "", trade_evaluation: "", instrument: "" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.direction).toBeNull();
      expect(res.data.trade_evaluation).toBeNull();
      expect(res.data.instrument).toBeNull();
    }
  });

  it('an empty <input type="time"> becomes null; HH:MM and HH:MM:SS both pass', () => {
    for (const [input, expected] of [["", null], ["09:30", "09:30"], ["09:30:00", "09:30:00"]] as const) {
      const res = tradeSchema.safeParse({ ...closed, tijd_open: input });
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.tijd_open).toBe(expected);
    }
    expect(messagesOf({ ...closed, tijd_open: "9u30" })).toContain("tradeForm.required");
  });
});
