// NL-copy voor elke faalcode van het schrijfpad (F2d). Pure map — het paneel
// toont nooit een rauwe code en nooit een `alert`: elke fout krijgt een zin die
// zegt wat de trader nú kan doen. De codes komen uit tradeFlow/tradePayload en
// InsertTradeResult; onbekende codes degraderen naar een generieke zin + detail.
import type { LogTradeResult } from "../../tradeFlow";

export type LogTradeFailure = Extract<LogTradeResult, { ok: false }>;

export interface ErrorCopy {
  /** Wat er mis is, in één zin. */
  message: string;
  /** Technische bijzin (symbool, kolom, zod-pad) — klein en mono. */
  detail?: string;
}

/** Zod-boodschappen zijn i18n-sleutels (de web-app vertaalt ze); de extensie
 * heeft geen i18n-infra, dus hier een kleine NL-woordenlijst. */
const SCHEMA_MESSAGES: Record<string, string> = {
  "tradeForm.required": "is verplicht",
  "tradeForm.closeBeforeOpen": "ligt vóór de opening",
  "tradeForm.riskMustBePositive": "moet groter dan 0 zijn",
  "tradeForm.excursionMustBePositive": "mag niet negatief zijn",
  "tradeForm.lossMustBeNegative": "hoort bij een Loss negatief te zijn",
  "tradeForm.winMustBePositive": "hoort bij een Win positief te zijn",
};

const FIELD_LABELS: Record<string, string> = {
  resultaat_pct: "Resultaat %",
  risk_pct: "Risico %",
  outcome: "Uitkomst",
  direction: "Richting",
  datum_open: "Datum",
  tijd_open: "Tijd",
  datum_sluiting: "Sluitdatum",
  planned_rr: "R:R",
  entry_price: "Entry",
  stop_price: "Stop",
  target_price: "Target",
  pair: "Pair",
  instrument: "Instrument",
  fase: "Fase",
};

/** "resultaat_pct: tradeForm.lossMustBeNegative" → "Resultaat % hoort bij een Loss negatief te zijn". */
export function humanizeSchemaDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const idx = detail.indexOf(":");
  if (idx < 0) return detail;
  const path = detail.slice(0, idx).trim();
  const message = detail.slice(idx + 1).trim();
  const key = path.split(".").pop() ?? path;
  const label = FIELD_LABELS[key];
  const text = SCHEMA_MESSAGES[message];
  if (!label && !text) return detail;
  return `${label ?? key} ${text ?? message}`;
}

export function logTradeErrorCopy(failure: LogTradeFailure): ErrorCopy {
  const { error, detail } = failure;
  switch (error) {
    case "not-linked":
      return { message: "Niet gekoppeld — open de extensie-popup en verbind je Beyen-account." };
    case "not-beta":
      return { message: "De TradingView-extensie is nog beta-only voor dit account." };
    case "profile-unreadable":
      return { message: "Je Beyen-profiel is niet leesbaar — koppel de extensie opnieuw." };
    case "symbol-not-in-pairs":
      return {
        message: `${detail ?? "Dit symbool"} zit niet in de forex-lijst van dit journal — kies handmatig of log in een ander journal.`,
      };
    case "symbol-unreadable":
      return { message: "Het symbool van deze chart is onleesbaar.", detail };
    case "direction-price-mismatch":
      return {
        message:
          "Richting en prijzen spreken elkaar tegen: bij een Long hoort de stop ónder de entry, bij een Short erboven. Pas de richting of de prijzen aan.",
        detail,
      };
    case "stop-equals-entry":
      return { message: "Stop en entry zijn gelijk — zonder risico-afstand is er geen R te berekenen." };
    case "no-entry-time":
      return { message: "Geen tijd gevonden bij de position-tool — vul datum en tijd handmatig in." };
    case "empty-client-uuid":
      return { message: "Interne fout: geen idempotentie-sleutel. Sluit het paneel en probeer opnieuw." };
    case "missing-column":
      return { message: "De database mist nog migratie 0058 — draai die eerst.", detail };
    case "constraint":
      return { message: "De database weigerde deze trade.", detail };
    case "schema-invalid":
      return { message: "De trade komt niet door de controles.", detail: humanizeSchemaDetail(detail) };
    default:
      return { message: "Loggen is niet gelukt.", detail: detail ?? error };
  }
}
