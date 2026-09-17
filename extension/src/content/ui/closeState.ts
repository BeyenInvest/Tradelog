// Beslislogica van de sluit-sectie (F5b, plan §7.3). Pure module —
// closeSection.ts rendert alleen wat hier uitkomt, zoals snapshotsSection.ts dat
// met snapshotState.ts doet.
//
// Vier regels die de vorm verklaren:
//  1. Het paneel REKENT NIETS. previewClose (closeFlow, F5a) is het enige
//     rekenpad van de live preview; closeTradeFromChart leidt het resultaat
//     server-side nóg eens af. Hier staat alleen keuze, validatie en copy.
//  2. Exit-prijs kan alleen als de trade richting + entry + stop draagt én de
//     chart een laatste bar geeft — die bar levert immers óók het sluitmoment.
//     Mist er iets, dan is handmatig % de modus (de user mag zelf wisselen).
//  3. De sluitdatum komt uit de bar-tijd van de chart (replay-veilig: in replay
//     is dat de replay-candle) of uit een expliciet datumveld. Nooit stil
//     Date.now() — dat is dezelfde afspraak als closeFlow.ts.
//  4. "Missed trade" bestaat hier niet en de outcome is nooit kiesbaar: een
//     gesloten positie is per definitie genomen, en Win/Loss/BE volgt uit het
//     resultaat (missed-trade-contract, CLAUDE.md).
import type { Direction, GradedEvaluation, Outcome } from "../../../../src/lib/constants";
import type { LastBarInfo } from "../../adapter/parse";
import { previewClose, type CloseTradeRequest, type OpenTradeMatch, type OpenTradesResult } from "../../closeFlow";
import { t, type MessageKey } from "../../i18nExt";
import { SNAPSHOT_SLOTS, type SnapshotSlot } from "../../snapshots";
import { formatPrice, formatRR, parseNumberInput } from "./format";

export type CloseMode = "exit-price" | "manual";

/** Alles wat de user in het sluit-formulier invult; leeft buiten de DOM, zodat
 * een hertekening (taalwissel, nieuwe chart-lezing) geen invoer kost. */
export interface CloseForm {
  mode: CloseMode;
  /** Rauwe invoer; parsen gebeurt pas bij preview/submit. */
  exit: string;
  manualPct: string;
  /** "YYYY-MM-DD" — alleen het handmatige pad vraagt hierom. */
  manualDate: string;
  /** Lege string = geen evaluatie; nooit "Missed trade". */
  evaluation: string;
  mae: string;
  mfe: string;
}

/** De prijzen die het exit-prijs-pad nodig heeft, of null als de trade er één mist. */
export interface ExitInputs {
  direction: Direction;
  entry: number;
  stop: number;
  riskPct: number | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function exitInputs(trade: OpenTradeMatch): ExitInputs | null {
  const { direction, entryPrice, stopPrice, riskPct } = trade;
  if (direction == null || entryPrice == null || stopPrice == null) return null;
  return { direction, entry: entryPrice, stop: stopPrice, riskPct };
}

/** Exit-prijs is pas een pad mét prijzen én een bar: de bar geeft het sluitmoment. */
export function exitPriceAvailable(trade: OpenTradeMatch, bar: LastBarInfo | null): boolean {
  return bar != null && exitInputs(trade) !== null;
}

export function defaultMode(trade: OpenTradeMatch, bar: LastBarInfo | null): CloseMode {
  return exitPriceAvailable(trade, bar) ? "exit-price" : "manual";
}

/** Verse formulier-staat voor één trade; de exit komt van de laatste candle. */
export function initialForm(trade: OpenTradeMatch, bar: LastBarInfo | null): CloseForm {
  const mode = defaultMode(trade, bar);
  return {
    mode,
    exit: mode === "exit-price" && bar ? String(bar.close) : "",
    manualPct: "",
    manualDate: "",
    evaluation: "",
    mae: "",
    mfe: "",
  };
}

/** Live preview van het exit-prijs-pad: R + resultaat% + afgeleide outcome.
 * null = (nog) niets te tonen — geen eigen rekenwerk als terugval. */
export function closePreview(
  trade: OpenTradeMatch,
  form: CloseForm,
  bar: LastBarInfo | null
): { r: number; resultaatPct: number; outcome: Outcome } | null {
  if (form.mode !== "exit-price") return null;
  const inputs = exitInputs(trade);
  if (!inputs || bar == null) return null;
  const exit = parseNumberInput(form.exit);
  if (exit == null || exit <= 0) return null;
  return previewClose(inputs.direction, inputs.entry, inputs.stop, exit, inputs.riskPct);
}

export type BuiltClose =
  | { ok: true; request: CloseTradeRequest }
  | { ok: false; message: string };

/** Leeg = niet ingevuld, niet-getal = fout, negatief = fout (0049-checks). */
function excursion(raw: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const value = parseNumberInput(raw);
  if (value == null) return "invalid";
  return value < 0 ? "invalid" : value;
}

/**
 * Formulier-waarden → CloseTradeRequest, of de zin die de user nog mist. Dezelfde
 * opzet als buildRequest() in panelApp: één plek die zowel de knop-status als de
 * foutmelding voedt.
 */
export function buildCloseRequest(
  trade: OpenTradeMatch,
  form: CloseForm,
  bar: LastBarInfo | null
): BuiltClose {
  let result: CloseTradeRequest["result"];
  let closeTimeUtcSec: number | null = null;
  let manualDate: string | null = null;

  if (form.mode === "exit-price") {
    const inputs = exitInputs(trade);
    if (!inputs) return { ok: false, message: t("close.v.noExitPath") };
    if (bar == null) return { ok: false, message: t("close.v.noBar") };
    const exit = parseNumberInput(form.exit);
    if (exit == null) return { ok: false, message: t("close.v.needExit") };
    if (exit <= 0) return { ok: false, message: t("close.v.exitPositive") };
    // previewClose weigert bij stop === entry of een SL aan de verkeerde kant;
    // dan heeft doorsturen geen zin — dezelfde zin als bij het loggen.
    if (previewClose(inputs.direction, inputs.entry, inputs.stop, exit, inputs.riskPct) == null) {
      return { ok: false, message: t("err.directionMismatch") };
    }
    result = { kind: "exit-price", direction: inputs.direction, entry: inputs.entry, stop: inputs.stop, exit, riskPct: inputs.riskPct };
    closeTimeUtcSec = bar.timeSec;
  } else {
    const pct = parseNumberInput(form.manualPct);
    if (pct == null) return { ok: false, message: t("close.v.needResult") };
    if (!DATE_RE.test(form.manualDate)) return { ok: false, message: t("close.v.needDate") };
    if (DATE_RE.test(trade.datumOpen) && form.manualDate < trade.datumOpen) {
      return { ok: false, message: t("close.v.closeBeforeOpen", { date: trade.datumOpen }) };
    }
    result = { kind: "manual", resultaatPct: pct };
    manualDate = form.manualDate;
  }

  const mae = excursion(form.mae);
  const mfe = excursion(form.mfe);
  if (mae === "invalid" || mfe === "invalid") return { ok: false, message: t("close.v.excursion") };

  return {
    ok: true,
    request: {
      tradeId: trade.id,
      datumOpen: trade.datumOpen,
      result,
      evaluation: form.evaluation ? form.evaluation : null,
      maePct: mae,
      mfePct: mfe,
      closeTimeUtcSec,
      manualDate,
    },
  };
}

/** Een mislukte lezing toont geen sectie: zonder lijst valt er niets te sluiten
 * (de foutcopy zou hier alleen ruis zijn naast het log-formulier). */
export function tradesToShow(result: OpenTradesResult | null): OpenTradeMatch[] {
  return result && result.ok ? result.trades : [];
}

/** Eén regel per open trade: wanneer, welke kant, entry→stop en het plan-R. */
export interface TradeSummary {
  when: string;
  direction: string;
  range: string;
  rr: string;
}

export function tradeSummary(trade: OpenTradeMatch): TradeSummary {
  // tijd_open staat als "HH:MM:SS" in de DB; seconden zijn hier ruis.
  const time = trade.tijdOpen ? trade.tijdOpen.slice(0, 5) : "";
  const range =
    trade.entryPrice != null && trade.stopPrice != null
      ? `${formatPrice(trade.entryPrice)} → ${formatPrice(trade.stopPrice)}`
      : "—";
  return {
    when: time ? `${trade.datumOpen} ${time}` : trade.datumOpen,
    // Long/Short blijft de rauwe enum-waarde (trading-leenwoord, zoals in de app).
    direction: trade.direction ?? "—",
    range,
    rr: formatRR(trade.plannedRR),
  };
}

/** Vaste trade-evaluaties → i18n-sleutel; de opgeslagen waarde blijft de rauwe
 * enum-string (zelfde afspraak als het `enums`-namespace van de web-app). */
const EVALUATION_KEYS: Record<GradedEvaluation, MessageKey> = {
  "Good trade": "close.eval.good",
  "Emotional error": "close.eval.emotional",
  "Technical error": "close.eval.technical",
};

export function evaluationLabelKey(value: GradedEvaluation): MessageKey {
  return EVALUATION_KEYS[value];
}

// ── Bewerken van de zojuist gelogde trade (F5b, "Nog aanpassen") ────────────

/**
 * Snapshot-paden van de bewerking: wat er nú in de sectie staat wint, en waar
 * die leeg is blijft het pad van de log staan. Zonder deze merge zou een update
 * de screenshot-kolommen van de trade leegvegen — de sectie is na een geslaagde
 * log immers verst (consume()).
 */
export function mergeScreenshots(
  previous: Partial<Record<SnapshotSlot, string | null>> | null | undefined,
  current: Partial<Record<SnapshotSlot, string | null>>
): Record<SnapshotSlot, string | null> {
  const out = {} as Record<SnapshotSlot, string | null>;
  for (const slot of SNAPSHOT_SLOTS) out[slot] = current[slot] ?? previous?.[slot] ?? null;
  return out;
}
