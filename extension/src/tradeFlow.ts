// Schrijfpad van het paneel naar de DB (F2d-serverkant, plan §2.4). Pure
// orkestratie over ExtensionDb + de gedeelde buildTradePayload — het paneel
// rekent zelf niets. De client-uuid komt van het paneel en blijft gelijk bij
// een retry, zodat import_ref de dubbele insert idempotent maakt.
import type { Direction } from "../../src/lib/constants";
import { normalizeTvSymbol } from "../../src/lib/symbolNormalize";
import {
  buildTradePayload, type TradeMode, type WallClock,
} from "../../src/lib/tradePayload";
import type { ExtensionDb, JournalSchema } from "./db";

export interface LogTradeRequest {
  /** Rauw TV-symbool ("OANDA:AUDJPY") — normalisatie gebeurt hier, niet in de UI. */
  symbolRaw: string;
  target: { type: "live" } | { type: "project"; projectId: string };
  mode: TradeMode;
  direction: Direction | null;
  prices: { entry: number; stop: number; target: number | null } | null;
  /** Bar-tijd uit de position-tool in UTC-SECONDEN (zoals TV ze geeft). */
  entryTimeUtcSec: number | null;
  manualDateTime?: WallClock | null;
  riskPct: number | null;
  custom: Record<string, unknown>;
  notes?: string | null;
  clientUuid: string;
}

export type LogTradeResult =
  | { ok: true; tradeId: string | null; duplicate: boolean }
  | { ok: false; stage: "auth" | "profile" | "build" | "insert"; error: string; detail?: string };

/** Eerste fase-optie van een legacy journal (het `fase`-veld draagt z'n opties);
 * anders dezelfde stille "Fase 1"-default als quick-log (plan M3). */
export function firstFaseOf(journal: JournalSchema | null): string {
  const faseField = journal?.fields.find((f) => f.fieldKey === "fase");
  const options = faseField?.options;
  if (Array.isArray(options) && typeof options[0] === "string" && options[0]) return options[0];
  return "Fase 1";
}

export async function logTradeFromChart(db: ExtensionDb, req: LogTradeRequest): Promise<LogTradeResult> {
  const session = await db.getSessionInfo();
  if (!session) return { ok: false, stage: "auth", error: "not-linked" };

  const profile = await db.getProfile(session.userId);
  if (!profile) return { ok: false, stage: "profile", error: "profile-unreadable" };
  if (!profile.beta) return { ok: false, stage: "profile", error: "not-beta" };

  // Zoals de web-form: óók een backtest-trade draagt het actieve journal
  // (custom velden per journal gelden in projecten net zo goed); het project
  // komt er als backtest_project_id bovenop (plan M2).
  const journal = profile.methodologyId ? await db.getJournalSchema(profile.methodologyId) : null;

  const symbol = normalizeTvSymbol(req.symbolRaw);
  if (!symbol) return { ok: false, stage: "build", error: "symbol-unreadable", detail: req.symbolRaw };

  const built = buildTradePayload({
    symbol,
    isForexJournal: journal?.assetClass === "forex",
    target:
      req.target.type === "project"
        ? { type: "project", projectId: req.target.projectId, methodologyId: profile.methodologyId }
        : { type: "live", methodologyId: profile.methodologyId },
    timezone: profile.timezone,
    fase: firstFaseOf(journal),
    entryTimeUtcMs: req.entryTimeUtcSec != null ? req.entryTimeUtcSec * 1000 : null,
    manualDateTime: req.manualDateTime ?? null,
    mode: req.mode,
    direction: req.direction,
    prices: req.prices,
    riskPct: req.riskPct,
    custom: req.custom,
    clientUuid: req.clientUuid,
    notes: req.notes ?? null,
  });
  if (!built.ok) return { ok: false, stage: "build", error: built.error, detail: built.detail };

  const inserted = await db.insertTrade(built.payload);
  if (!inserted.ok) return { ok: false, stage: "insert", error: inserted.code, detail: inserted.error };
  return { ok: true, tradeId: inserted.tradeId, duplicate: inserted.duplicate };
}
