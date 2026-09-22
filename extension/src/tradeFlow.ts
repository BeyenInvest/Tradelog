// Schrijfpad van het paneel naar de DB (F2d-serverkant, plan §2.4). Pure
// orkestratie over ExtensionDb + de gedeelde buildTradePayload — het paneel
// rekent zelf niets. De client-uuid komt van het paneel en blijft gelijk bij
// een retry, zodat import_ref de dubbele insert idempotent maakt.
import type { Direction } from "../../src/lib/constants";
import { normalizeTvSymbol } from "../../src/lib/symbolNormalize";
import { buildTradePayload, type TradeMode, type WallClock } from "../../src/lib/tradePayload";
import type { ExtensionDb } from "./db";

export interface LogTradeRequest {
  /** Rauw TV-symbool ("OANDA:AUDJPY") — normalisatie gebeurt hier, niet in de UI. */
  symbolRaw: string;
  target: { type: "live" } | { type: "project"; projectId: string };
  mode: TradeMode;
  direction: Direction | null;
  prices: { entry: number; stop: number; target: number | null } | null;
  /** Bar-tijd uit de position-tool in UTC-SECONDEN (zoals TV ze geeft). */
  entryTimeUtcSec: number | null;
  /** Bar-tijd van de laatste bar (chart-"nu", replay-bewust) — sluitdatum bij post-hoc. */
  closeTimeUtcSec?: number | null;
  manualDateTime?: WallClock | null;
  riskPct: number | null;
  /** Alle methodology-antwoorden (incl. fase/cc/… op een WPM-journal) → trades.custom. */
  custom: Record<string, unknown>;
  notes?: string | null;
  clientUuid: string;
  /** Storage-paden uit de snapshot-cyclus (F3a) voor de vier vaste slots. */
  screenshots?: Partial<Record<"w" | "d" | "h4" | "h2", string | null>> | null;
}

export type LogTradeResult =
  | { ok: true; tradeId: string | null; duplicate: boolean }
  | { ok: false; stage: "auth" | "profile" | "build" | "insert" | "update"; error: string; detail?: string };

type PreparedTrade =
  | { ok: true; payload: Record<string, unknown> }
  | Extract<LogTradeResult, { ok: false }>;

/** Gedeelde bouw voor loggen (insert) én bijwerken (update, F5): dezelfde
 * poortwachters, dezelfde payload — de aanroeper kiest alleen het schrijfpad. */
async function prepareTradePayload(db: ExtensionDb, req: LogTradeRequest): Promise<PreparedTrade> {
  const session = await db.getSessionInfo();
  if (!session) return { ok: false, stage: "auth", error: "not-linked" };

  const profile = await db.getProfile(session.userId);
  if (!profile) return { ok: false, stage: "profile", error: "profile-unreadable" };

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
    entryTimeUtcMs: req.entryTimeUtcSec != null ? req.entryTimeUtcSec * 1000 : null,
    closeTimeUtcMs: req.closeTimeUtcSec != null ? req.closeTimeUtcSec * 1000 : null,
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

  // Snapshot-paden ná validatie in de payload prikken: het zijn dezelfde vier
  // kolommen als de web-form (w_/d_/h4_/h2_screenshot, plan C4).
  if (req.screenshots) {
    built.payload.w_screenshot = req.screenshots.w ?? null;
    built.payload.d_screenshot = req.screenshots.d ?? null;
    built.payload.h4_screenshot = req.screenshots.h4 ?? null;
    built.payload.h2_screenshot = req.screenshots.h2 ?? null;
  }

  return { ok: true, payload: built.payload };
}

export async function logTradeFromChart(db: ExtensionDb, req: LogTradeRequest): Promise<LogTradeResult> {
  const prepared = await prepareTradePayload(db, req);
  if (!prepared.ok) return prepared;
  const inserted = await db.insertTrade(prepared.payload);
  if (!inserted.ok) return { ok: false, stage: "insert", error: inserted.code, detail: inserted.error };
  return { ok: true, tradeId: inserted.tradeId, duplicate: inserted.duplicate };
}

/** F5: de laatst gelogde trade van deze tab bijwerken vóór hij "af" is — het
 * paneel onthoudt de clientUuid, wij vinden de rij terug op z'n import_ref en
 * schrijven exact dezelfde payload als een verse log (geen generieke editor,
 * de web-app blijft dé plek voor echte edits). */
export async function updateLoggedTradeByRef(db: ExtensionDb, req: LogTradeRequest): Promise<LogTradeResult> {
  const prepared = await prepareTradePayload(db, req);
  if (!prepared.ok) return prepared;
  const importRef = prepared.payload.import_ref;
  if (typeof importRef !== "string" || !importRef) {
    return { ok: false, stage: "build", error: "empty-client-uuid" };
  }
  const updated = await db.updateTrade({ importRef }, prepared.payload);
  if (!updated.ok) return { ok: false, stage: "update", error: updated.code, detail: updated.error };
  return { ok: true, tradeId: updated.tradeId, duplicate: false };
}
