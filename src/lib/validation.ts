import { z } from "zod";
import {
  CCS, OUTCOMES, PAIRS, STRUCTUREN, TRADE_EVALUATIONS, WEEKLY_CRITERIA, WEEKLY_KENMERKEN,
} from "./constants";

const boolField = z.boolean().nullable().optional().default(null);

/** Empty-string inputs must become null, not 0 — z.coerce.number() alone would turn "" into 0. */
const nullableNumber = z.preprocess(
  (val) => (val === "" || val == null ? null : val),
  z.coerce.number().nullable()
);

/** Empty-string inputs must fail as "required", not silently coerce to 0 — same z.coerce.number() footgun as above, but for a required field. */
const requiredNumber = z.preprocess(
  (val) => (val === "" || val == null ? undefined : val),
  z.coerce.number({ required_error: "tradeForm.required", invalid_type_error: "tradeForm.mustBeNumber" })
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
 * one list, no free text). Fase-kenmerken are optional, not required — accounts
 * get shared with users who don't use those fields, so answering them is a
 * choice, not a gate on saving the trade.
 */
export const tradeSchema = z
  .object({
    // Free text (a fase name from the user's methodology, Scope C) rather than a
    // fixed z.enum — the valid set is now per-user. The <select> in EntrySection,
    // fed by useMethodology, is still the only way to set it from the UI.
    fase: z.string().min(1, "tradeForm.required"),
    datum_open: z.string().min(1, "tradeForm.required"),
    datum_sluiting: nullableDateString.optional().default(null),
    pair: z.enum(PAIRS),
    outcome: z.enum(OUTCOMES),
    resultaat_pct: requiredNumber,
    // Optional planned risk %; null = the default 1% (DEFAULT_RISK_PCT). Positivity is
    // checked in the superRefine below (null passes; any entered value must be > 0).
    risk_pct: nullableNumber.optional().default(null),
    trade_evaluation: nullableEnum(TRADE_EVALUATIONS).optional().default(null),
    weekly_criteria: nullableEnum(WEEKLY_CRITERIA).optional().default(null),
    weekly_kenmerk: nullableEnum(WEEKLY_KENMERKEN).optional().default(null),
    // Deliberate exception to "one shared enum, no free text" above (same as `entry` below):
    // a user can register their own extra values (useCustomOptions, field="trade_concept") on
    // top of TRADE_CONCEPTS, so this can't be a static z.enum. The <select> in EntrySection.tsx
    // — TRADE_CONCEPTS + that user's own custom_options rows — is still the only way to set it.
    trade_concept: nullableString.optional().default(null),
    // Deliberate exception to "one shared enum, no free text" above: a user can register their own
    // extra values (useCustomOptions, field="entry") on top of ENTRIES, so this can't be a static
    // z.enum. The <select> in EntrySection.tsx — ENTRIES + that user's own custom_options rows — is
    // still the only way to set this from the UI.
    entry: nullableString.optional().default(null),
    cc: z.enum(CCS),
    nieuws: z.boolean().default(false),
    w_confirm: boolField,
    d_confirm: boolField,
    h4_confirm: boolField,
    w_screenshot: z.string().nullable().optional().default(null),
    d_screenshot: z.string().nullable().optional().default(null),
    h4_screenshot: z.string().nullable().optional().default(null),
    h2_screenshot: z.string().nullable().optional().default(null),
    extra_d_conf: boolField,
    notes: z.string().nullable().optional().default(null),

    fase1_daily_respecteert_zone: boolField,
    fase1_spelers_verleden: boolField,

    fase2_daily_respecteert_zone: boolField,
    fase2_structuur: nullableEnum(STRUCTUREN).optional().default(null),

    fase3_zone_min_2_touches: boolField,
    fase3_engulfing_candle: boolField,
    fase3_structuur: nullableEnum(STRUCTUREN).optional().default(null),

    fase4_weekly_bevestigingscandle: boolField,
  })
  .superRefine((data, ctx) => {
    if (data.datum_sluiting && data.datum_sluiting < data.datum_open) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["datum_sluiting"], message: "tradeForm.closeBeforeOpen" });
    }
    if (data.risk_pct != null && data.risk_pct <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["risk_pct"], message: "tradeForm.riskMustBePositive" });
    }
    // Guard against a fat-fingered sign: win-rate reads the `outcome` enum while
    // equity/drawdown/expectancy/R read the sign of resultaat_pct — a Loss logged
    // as +% (or a Win as -%) makes those two lenses silently contradict. BE is
    // left unconstrained (a scratch can carry a small spread cost either way).
    if (data.outcome === "Loss" && data.resultaat_pct > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resultaat_pct"], message: "tradeForm.lossMustBeNegative" });
    }
    if (data.outcome === "Win" && data.resultaat_pct < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resultaat_pct"], message: "tradeForm.winMustBePositive" });
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
