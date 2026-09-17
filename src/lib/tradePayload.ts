// Trade-payload-bouwer voor de TV-extensie (F2b, plan §2.4). Pure module — de
// extensie importeert dit rechtstreeks; de web-app deelt pruneCustom (één
// implementatie, plan §2.5). Bouwt exact wat createTrade()/PostgREST verwacht:
// quickLogDefaults-baseline + symbool-mapping (M5) + wall-clock in de
// profiel-tijdzone (M4) + open/post-hoc-modus (M1) + import_ref-idempotentie
// (C6), gevalideerd met dezelfde tradeSchema als de web-form.
//
// Prijzen landen sinds F2c (migratie 0058) in echte kolommen
// (entry_price/stop_price/target_price; exit_price = F5-haak). ⚠️ 0058 moet op
// prod gedraaid zijn vóórdat code die buildTradePayload aanroept deployt —
// anders weigert PostgREST de onbekende kolommen (0043-les).
import { type Direction, type Outcome } from "./constants";
import { directionFromPrices, plannedRR } from "./priceMath";
import { quickLogDefaults } from "./quickLog";
import { type NormalizedSymbol } from "./symbolNormalize";
import { tradeSchema, type TradeFormValues } from "./validation";
import { wallClockInTimezone, type WallClock } from "./wallClock";

/** Verwijder lege/onaffe waarden zodat trades.custom alleen beantwoorde velden
 * bevat (string|number|boolean). Gedeeld met TradeForm — niet dupliceren. */
export function pruneCustom(raw: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && Number.isNaN(v)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

// Verhuisd naar een eigen mini-module (wallClock.ts) zodat closeFlow — en dus
// de paneel-bundle — 'm kan importeren zonder validation.ts/zod mee te slepen;
// re-export zodat bestaande importeurs (tradeFlow, tests) niets merken.
export { wallClockInTimezone, type WallClock } from "./wallClock";

/**
 * De legacy-WPM-kolommen die het paneel op een legacy journal als echte velden
 * aanbiedt (spiegel van EntrySection/TechnicalSection/FaseKenmerkenSection).
 * Alleen déze sleutels mogen via `input.legacy` in top-level kolommen landen —
 * al het andere hoort in de custom-bag. `fase` loopt apart (input.fase) en
 * `fase3_beide` is computed en wordt nooit ingestuurd.
 */
export const LEGACY_TRADE_COLUMNS = [
  "cc", "trade_concept", "entry", "weekly_criteria", "weekly_kenmerk", "nieuws",
  "w_confirm", "d_confirm", "h4_confirm", "extra_d_conf",
  "fase1_daily_respecteert_zone", "fase1_spelers_verleden",
  "fase2_daily_respecteert_zone", "fase2_structuur",
  "fase3_zone_min_2_touches", "fase3_engulfing_candle", "fase3_structuur",
  "fase4_weekly_bevestigingscandle",
] as const;
export type LegacyTradeColumn = (typeof LEGACY_TRADE_COLUMNS)[number];

/** Doel van de trade: het live journal óf precies één backtest-project (M2). */
export type TradeTarget =
  | { type: "live"; methodologyId: string | null }
  | { type: "project"; projectId: string; methodologyId: string | null };

export type TradeMode =
  | { kind: "live-open" }
  | { kind: "post-hoc"; outcome: Outcome; resultaatPct: number; datumSluiting?: string | null };

export interface BuildTradeInput {
  symbol: NormalizedSymbol;
  /** Forex-journal: pair-veld leidend (en gespiegeld naar instrument, zoals de web-form doet). Anders: vrij instrument. */
  isForexJournal: boolean;
  target: TradeTarget;
  /** profiles.timezone (IANA). */
  timezone: string;
  /** Eerste fase van het journal of "Fase 1" — zelfde stille default als quick-log (M3). */
  fase: string;
  /**
   * Bar-tijd van de position-tool in UTC-ms (replay-bewust — NOOIT Date.now(),
   * plan-risico 10). Alternatief: expliciete wall-clock van de user.
   */
  entryTimeUtcMs: number | null;
  manualDateTime?: WallClock | null;
  mode: TradeMode;
  direction: Direction | null;
  /** Absolute prijzen uit de chart-adapter; target mag ontbreken (geen TP getekend). */
  prices: { entry: number; stop: number; target: number | null } | null;
  riskPct: number | null;
  /** Rauwe antwoorden uit de dynamische form — wordt gepruned. */
  custom: Record<string, unknown>;
  /**
   * Antwoorden op de legacy-WPM-velden van een legacy journal — landen in echte
   * trades.*-kolommen (whitelist LEGACY_TRADE_COLUMNS), niet in custom. Lege
   * waarden laten de quickLog-default staan.
   */
  legacy?: Partial<Record<LegacyTradeColumn, unknown>>;
  /** Client-uuid voor idempotentie; wordt `import_ref = "tv-ext:<uuid>"` (C6). */
  clientUuid: string;
  notes?: string | null;
}

/** Wat PostgREST ingestuurd krijgt: gevalideerde form-values + herkomst/idempotentie. */
export type ExtensionTradePayload = TradeFormValues & {
  import_ref: string;
  backtest_project_id: string | null;
};

export interface BuildTradeOk {
  ok: true;
  payload: ExtensionTradePayload;
  /** Voor paneel-weergave; prijzen krijgen pas kolommen in F2c. */
  derived: {
    prices: { entry: number; stop: number; target: number | null } | null;
    plannedRR: number | null;
    wallClock: WallClock;
  };
}

export interface BuildTradeError {
  ok: false;
  /** Stabiele code — het paneel vertaalt dit naar copy ("vul handmatig in"-degradatie). */
  error:
    | "symbol-not-in-pairs"
    | "no-entry-time"
    | "direction-price-mismatch"
    | "stop-equals-entry"
    | "empty-client-uuid"
    | "schema-invalid";
  detail?: string;
}

export const IMPORT_REF_PREFIX = "tv-ext:";

export function buildTradePayload(input: BuildTradeInput): BuildTradeOk | BuildTradeError {
  const clientUuid = input.clientUuid.trim();
  if (!clientUuid) return { ok: false, error: "empty-client-uuid" };

  // M4/risico 10: tijd komt uit de bar-time (ook in replay correct) of expliciet
  // van de user — nooit uit de klok van dit moment.
  const wallClock =
    input.manualDateTime ??
    (input.entryTimeUtcMs != null ? wallClockInTimezone(input.entryTimeUtcMs, input.timezone) : null);
  if (!wallClock) return { ok: false, error: "no-entry-time" };

  // M5: forex-journal → pair leidend (gespiegeld naar instrument, zoals de
  // web-form op submit doet); geen pair-match = expliciete fout, geen gok.
  // Ander journal → vrij instrument, pair blijft de verborgen baseline-default.
  const values = quickLogDefaults(input.fase, wallClock.date);
  if (input.isForexJournal) {
    if (!input.symbol.pair) {
      return { ok: false, error: "symbol-not-in-pairs", detail: input.symbol.instrument };
    }
    values.pair = input.symbol.pair;
    values.instrument = input.symbol.pair;
  } else {
    values.instrument = input.symbol.instrument;
  }

  values.tijd_open = wallClock.time;
  values.methodology_id = input.target.methodologyId;
  values.direction = input.direction;
  values.risk_pct = input.riskPct;
  values.notes = input.notes ?? null;
  values.custom = pruneCustom(input.custom);

  // Legacy-WPM-antwoorden → echte kolommen, strikt via de whitelist. De typen
  // bewaakt tradeSchema hieronder (cc/weekly_*/structuur zijn enums, confirms
  // en kenmerken zijn tri-state booleans) — ongeldig = schema-invalid, geen gok.
  if (input.legacy) {
    for (const key of LEGACY_TRADE_COLUMNS) {
      const v = input.legacy[key];
      if (v === undefined || v === null || v === "") continue;
      (values as Record<string, unknown>)[key] = v;
    }
  }

  if (input.prices) {
    const { entry, stop, target } = input.prices;
    const implied = directionFromPrices(entry, stop);
    if (!implied) return { ok: false, error: "stop-equals-entry" };
    if (input.direction && implied !== input.direction) {
      // Verkeerde SL-kant = stil verkeerde R — hard weigeren i.p.v. corrigeren.
      return { ok: false, error: "direction-price-mismatch", detail: `${input.direction} vs ${implied}` };
    }
    values.direction = input.direction ?? implied;
    values.planned_rr = target != null ? plannedRR(entry, stop, target) : null;
    values.entry_price = entry;
    values.stop_price = stop;
    values.target_price = target;
  }

  // M1: open-trade-constraint (0043) — open ⇒ outcome/resultaat/evaluatie/MAE/MFE
  // null (planned_rr mag). quickLogDefaults zet BE/0 als placeholder; hier expliciet
  // terug naar null zodat de DB-check nooit knalt.
  if (input.mode.kind === "live-open") {
    values.is_open = true;
    values.outcome = null;
    values.resultaat_pct = null;
    values.trade_evaluation = null;
    values.mae_pct = null;
    values.mfe_pct = null;
  } else {
    values.is_open = false;
    values.outcome = input.mode.outcome;
    values.resultaat_pct = input.mode.resultaatPct;
    values.datum_sluiting = input.mode.datumSluiting ?? null;
  }

  // Zelfde validatie als de web-form (plan §2.4) — vangt o.a. het Loss-met-+%-
  // tekenfout-guard en de open/gesloten-regels af vóór er iets richting DB gaat.
  const parsed = tradeSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: "schema-invalid", detail: `${first?.path.join(".")}: ${first?.message}` };
  }

  return {
    ok: true,
    payload: {
      ...parsed.data,
      import_ref: `${IMPORT_REF_PREFIX}${clientUuid}`,
      backtest_project_id: input.target.type === "project" ? input.target.projectId : null,
    },
    derived: {
      prices: input.prices,
      plannedRR: values.planned_rr ?? null,
      wallClock,
    },
  };
}
