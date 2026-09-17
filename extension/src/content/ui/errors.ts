// Copy voor elke faalcode van het schrijfpad (F2d), NL én EN (F4b). Pure map —
// het paneel toont nooit een rauwe code en nooit een `alert`: elke fout krijgt
// een zin die zegt wat de trader nú kan doen. De codes komen uit
// tradeFlow/tradePayload en InsertTradeResult; onbekende codes degraderen naar
// een generieke zin + detail.
//
// `detail` blijft bewust onvertaald: dat is de technische bijzin uit de service
// worker (Postgres-kolom, adapter-reden). Die willen we letterlijk kunnen
// terugzoeken in de diagnose-log, niet in twee varianten.
import { t, type MessageKey } from "../../i18nExt";
import type { LogTradeResult } from "../../tradeFlow";

export type LogTradeFailure = Extract<LogTradeResult, { ok: false }>;

export interface ErrorCopy {
  /** Wat er mis is, in één zin. */
  message: string;
  /** Technische bijzin (symbool, kolom, zod-pad) — klein en mono. */
  detail?: string;
}

/** Zod-boodschappen zijn i18n-sleutels van de web-app (die vertaalt ze met
 * i18next); de extensie mapt ze op haar eigen woordenlijst. */
const SCHEMA_MESSAGES: Record<string, MessageKey> = {
  "tradeForm.required": "err.schema.required",
  "tradeForm.closeBeforeOpen": "err.schema.closeBeforeOpen",
  "tradeForm.riskMustBePositive": "err.schema.riskMustBePositive",
  "tradeForm.excursionMustBePositive": "err.schema.excursionMustBePositive",
  "tradeForm.lossMustBeNegative": "err.schema.lossMustBeNegative",
  "tradeForm.winMustBePositive": "err.schema.winMustBePositive",
};

const FIELD_LABELS: Record<string, MessageKey> = {
  resultaat_pct: "err.field.resultaat_pct",
  risk_pct: "err.field.risk_pct",
  outcome: "err.field.outcome",
  direction: "err.field.direction",
  datum_open: "err.field.datum_open",
  tijd_open: "err.field.tijd_open",
  datum_sluiting: "err.field.datum_sluiting",
  planned_rr: "err.field.planned_rr",
  entry_price: "err.field.entry_price",
  stop_price: "err.field.stop_price",
  target_price: "err.field.target_price",
  pair: "err.field.pair",
  instrument: "err.field.instrument",
  fase: "err.field.fase",
};

/** "resultaat_pct: tradeForm.lossMustBeNegative" → "Resultaat % hoort bij een Loss negatief te zijn". */
export function humanizeSchemaDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const idx = detail.indexOf(":");
  if (idx < 0) return detail;
  const path = detail.slice(0, idx).trim();
  const message = detail.slice(idx + 1).trim();
  const key = path.split(".").pop() ?? path;
  const labelKey = FIELD_LABELS[key];
  const messageKey = SCHEMA_MESSAGES[message];
  if (!labelKey && !messageKey) return detail;
  return `${labelKey ? t(labelKey) : key} ${messageKey ? t(messageKey) : message}`;
}

export function logTradeErrorCopy(failure: LogTradeFailure): ErrorCopy {
  const { error, detail } = failure;
  switch (error) {
    case "not-linked":
      return { message: t("err.notLinked") };
    case "not-beta":
      return { message: t("err.notBeta") };
    case "profile-unreadable":
      return { message: t("err.profileUnreadable") };
    case "symbol-not-in-pairs":
      return { message: t("err.symbolNotInPairs", { symbol: detail ?? t("err.symbolFallback") }) };
    case "symbol-unreadable":
      return { message: t("err.symbolUnreadable"), detail };
    case "direction-price-mismatch":
      return { message: t("err.directionMismatch"), detail };
    case "stop-equals-entry":
      return { message: t("err.stopEqualsEntry") };
    case "no-entry-time":
      return { message: t("err.noEntryTime") };
    case "empty-client-uuid":
      return { message: t("err.emptyClientUuid") };
    case "missing-column":
      return { message: t("err.missingColumn"), detail };
    case "constraint":
      return { message: t("err.constraint"), detail };
    case "schema-invalid":
      return { message: t("err.schemaInvalid"), detail: humanizeSchemaDetail(detail) };
    default:
      return { message: t("err.generic"), detail: detail ?? error };
  }
}
