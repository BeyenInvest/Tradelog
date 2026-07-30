import { z } from "zod";
import {
  CCS, ENTRIES, FASES, OUTCOMES, PAIRS, STRUCTUREN, TRADE_CONCEPTS, TRADE_EVALUATIONS, WEEKLY_CRITERIA, WEEKLY_KENMERKEN,
} from "./constants";

const boolField = z.boolean().nullable().optional().default(null);

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

/**
 * Mirrors TradeInput (src/lib/types.ts). Enum fields use z.enum bound to the
 * same constant arrays as the DB schema (rekenregel 7 — strict validation,
 * one list, no free text). Fase-conditional requiredness (spec 3.2) is
 * enforced here via superRefine, deliberately NOT as a DB constraint (schema.sql
 * stays permissive for a future bulk migration import).
 */
export const tradeSchema = z
  .object({
    fase: z.enum(FASES),
    datum_open: z.string().min(1, "Verplicht"),
    datum_sluiting: nullableDateString.optional().default(null),
    pair: z.enum(PAIRS),
    outcome: z.enum(OUTCOMES),
    resultaat_pct: z.coerce.number(),
    trade_evaluation: nullableEnum(TRADE_EVALUATIONS).optional().default(null),
    weekly_criteria: nullableEnum(WEEKLY_CRITERIA).optional().default(null),
    weekly_kenmerk: nullableEnum(WEEKLY_KENMERKEN).optional().default(null),
    trade_concept: nullableEnum(TRADE_CONCEPTS).optional().default(null),
    entry: nullableEnum(ENTRIES).optional().default(null),
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
    tpfs_pct: nullableNumber.optional().default(null),
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
    if (data.fase === "Fase 1") {
      if (data.fase1_daily_respecteert_zone == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase1_daily_respecteert_zone"], message: "Verplicht voor Fase 1" });
      }
      if (data.fase1_spelers_verleden == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase1_spelers_verleden"], message: "Verplicht voor Fase 1" });
      }
    }
    if (data.fase === "Fase 2") {
      if (data.fase2_daily_respecteert_zone == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase2_daily_respecteert_zone"], message: "Verplicht voor Fase 2" });
      }
      if (data.fase2_structuur == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase2_structuur"], message: "Verplicht voor Fase 2" });
      }
    }
    if (data.fase === "Fase 3") {
      if (data.fase3_zone_min_2_touches == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase3_zone_min_2_touches"], message: "Verplicht voor Fase 3" });
      }
      if (data.fase3_engulfing_candle == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase3_engulfing_candle"], message: "Verplicht voor Fase 3" });
      }
      if (data.fase3_structuur == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase3_structuur"], message: "Verplicht voor Fase 3" });
      }
    }
    if (data.fase === "Fase 4") {
      if (data.fase4_weekly_bevestigingscandle == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fase4_weekly_bevestigingscandle"], message: "Verplicht voor Fase 4" });
      }
    }
    if (data.datum_sluiting && data.datum_sluiting < data.datum_open) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["datum_sluiting"], message: "Kan niet voor datum open liggen" });
    }
  });

export type TradeFormValues = z.infer<typeof tradeSchema>;

const emailField = z.string().min(1, "Verplicht").email("Ongeldig e-mailadres");
const passwordField = z.string().min(8, "Minimaal 8 tekens");

export const signupSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Verplicht om verder te gaan" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Wachtwoorden komen niet overeen",
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
    message: "Wachtwoorden komen niet overeen",
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
