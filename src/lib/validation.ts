import { z } from "zod";
import { DIRECTIONS, OUTCOMES, PAIRS, TRADE_EVALUATIONS } from "./constants";

/** Empty-string inputs must become null, not 0 — z.coerce.number() alone would turn "" into 0. */
const nullableNumber = z.preprocess(
  (val) => (val === "" || val == null ? null : val),
  z.coerce.number().nullable()
);

/** An empty <input type="date"> submits "" — must become null, not an invalid empty-string date. */
const nullableDateString = z.preprocess(
  (val) => (val === "" || val == null ? null : val),
  z.string().nullable()
);

/** An unselected <select> (placeholder option) submits "" — must become null, not fail enum validation. */
function nullableEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.preprocess((val) => (val === "" || val == null ? null : val), z.enum(values).nullable());
}

/** Same "" -> null coercion as nullableEnum, but for `entry` (see below) which isn't a static enum. */
const nullableString = z.preprocess((val) => (val === "" || val == null ? null : val), z.string().nullable());

/**
 * Mirrors TradeInput (src/lib/types.ts). Enum fields use z.enum bound to the
 * same constant arrays as the DB schema (rekenregel 7 — strict validation,
 * one list, no free text). Methodology-specific fields (incl. the former Weekly
 * Phase Method fields: fase, cc, weekly criteria/kenmerk, confirms, …) live in
 * the per-journal `custom` bag since the fase-retirement (0059), enforced
 * dynamically via missingRequiredCustomFields, not statically here.
 */
export const tradeSchema = z
  .object({
    datum_open: z.string().min(1, "tradeForm.required"),
    // Optional real open time (Fase S2, 0051). An empty <input type="time">
    // submits "" -> null; a filled one submits "HH:MM" (the DB reads that fine,
    // and returns "HH:MM:SS" — both pass, editing re-truncates to HH:MM).
    tijd_open: z.preprocess(
      (val) => (val === "" || val == null ? null : val),
      z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "tradeForm.required").nullable()
    ).optional().default(null),
    datum_sluiting: nullableDateString.optional().default(null),
    pair: z.enum(PAIRS),
    // Free instrument symbol (cyclus 7). Forex journals mirror pair into this on
    // submit; non-forex journals type their own. Free text like `entry`, not an enum.
    instrument: nullableString.optional().default(null),
    direction: nullableEnum(DIRECTIONS).optional().default(null),
    // A still-running trade (migration 0043): outcome + resultaat are omitted while
    // open and required once closed — enforced conditionally in the superRefine below,
    // not as a static z.enum/requiredNumber, so an open trade can be saved without them.
    is_open: z.boolean().default(false),
    outcome: nullableEnum(OUTCOMES).optional().default(null),
    resultaat_pct: nullableNumber.optional().default(null),
    // Optional planned risk %; null = the default 1% (DEFAULT_RISK_PCT). Positivity is
    // checked in the superRefine below (null passes; any entered value must be > 0).
    risk_pct: nullableNumber.optional().default(null),
    trade_evaluation: nullableEnum(TRADE_EVALUATIONS).optional().default(null),
    // Exit-analyse (Fase N3): optional MAE/MFE (positive magnitudes, % of account)
    // + planned reward:risk. Sign/positivity checked in the superRefine below.
    mae_pct: nullableNumber.optional().default(null),
    mfe_pct: nullableNumber.optional().default(null),
    planned_rr: nullableNumber.optional().default(null),
    // Chart-prijzen (F2c, 0058). Bewust alleen nullable numbers hier: de
    // cross-field-regels (entry+stop-paar, stop<>entry, richting-consistentie)
    // leven al in de DB-checks én in buildTradePayload — een derde kopie in
    // zod zou drie plekken synchroon moeten houden. De web-form toont deze
    // velden pas in F2d/F5.
    entry_price: nullableNumber.optional().default(null),
    stop_price: nullableNumber.optional().default(null),
    target_price: nullableNumber.optional().default(null),
    exit_price: nullableNumber.optional().default(null),
    w_screenshot: z.string().nullable().optional().default(null),
    d_screenshot: z.string().nullable().optional().default(null),
    h4_screenshot: z.string().nullable().optional().default(null),
    h2_screenshot: z.string().nullable().optional().default(null),
    notes: z.string().nullable().optional().default(null),

    // Scope C, cyclus 3. `custom` is the flexible per-trade bag keyed by
    // MethodologyField.field_key; its shape is per-user so it can't be a fixed
    // object schema. Values are `unknown` here because the RAW form state carries
    // in-progress junk (empty enum "" , empty number NaN, null toggles) that a
    // strict union would reject; CustomFieldsSection renders it and TradeForm
    // prunes it to string|number|boolean before saving. `methodology_id` records
    // which journal the trade was logged under.
    custom: z.record(z.string(), z.unknown()).default({}),
    methodology_id: z.string().nullable().optional().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.datum_sluiting && data.datum_sluiting < data.datum_open) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["datum_sluiting"], message: "tradeForm.closeBeforeOpen" });
    }
    if (data.risk_pct != null && data.risk_pct <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["risk_pct"], message: "tradeForm.riskMustBePositive" });
    }
    // MAE/MFE are magnitudes ("how far against/for you"), entered as positive
    // numbers — a negative entry is the classic sign mistake, caught here rather
    // than silently stored (the DB checks would reject it anyway).
    if (data.mae_pct != null && data.mae_pct < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mae_pct"], message: "tradeForm.excursionMustBePositive" });
    }
    if (data.mfe_pct != null && data.mfe_pct < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mfe_pct"], message: "tradeForm.excursionMustBePositive" });
    }
    if (data.planned_rr != null && data.planned_rr <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["planned_rr"], message: "tradeForm.riskMustBePositive" });
    }
    // A still-running trade has no realized result yet; a closed one must carry both.
    if (!data.is_open) {
      if (data.outcome == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outcome"], message: "tradeForm.required" });
      }
      if (data.resultaat_pct == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resultaat_pct"], message: "tradeForm.required" });
      }
      // Guard against a fat-fingered sign: win-rate reads the `outcome` enum while
      // equity/drawdown/expectancy/R read the sign of resultaat_pct — a Loss logged
      // as +% (or a Win as -%) makes those two lenses silently contradict. BE is
      // left unconstrained (a scratch can carry a small spread cost either way).
      if (data.outcome === "Loss" && data.resultaat_pct != null && data.resultaat_pct > 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resultaat_pct"], message: "tradeForm.lossMustBeNegative" });
      }
      if (data.outcome === "Win" && data.resultaat_pct != null && data.resultaat_pct < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resultaat_pct"], message: "tradeForm.winMustBePositive" });
      }
    }
  });

export type TradeFormValues = z.infer<typeof tradeSchema>;

// Auth-form validation messages are stored as i18n keys, not literal text — the auth
// pages resolve them with t(errors.<field>.message) at render (see SignupPage etc.).
const emailField = z.string().min(1, "auth.emailRequired").email("auth.emailInvalid");
const passwordField = z.string().min(8, "auth.passwordMin");

export const signupSchema = z
  .object({
    displayName: z.string().trim().min(1, "auth.nameRequired").max(60, "auth.nameTooLong"),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "auth.acceptTermsRequired" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.passwordMismatch",
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "auth.passwordMismatch",
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
