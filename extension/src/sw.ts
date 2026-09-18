// MV3 service worker — auth-eigenaar van de extensie (plan §2.6). Houdt de
// Supabase-sessie in chrome.storage, ververst via chrome.alarms en beantwoordt
// popup-berichten. Geen writes naar trades in F1b.
import { parseChartState } from "./adapter/parse";
import { REFRESH_ALARM_MINUTES, REFRESH_ALARM_NAME } from "./config";
import type { ExtRequest, ExtResponses } from "./messages";
import { fetchJournalDump, getStatus, linkWithToken } from "./linkFlow";
import {
  cropToRect, isGestureError, runSnapshotCycle, thumbnailDataUrl,
  type CaptureResult, type ChartRect, type SnapshotDeps, type SnapshotSlot,
} from "./snapshots";
import { appendLog, readLog } from "./storage";
import { closeTradeFromChart, listOpenTradesForSymbol } from "./closeFlow";
import { createExtensionClient, createSupabaseDb } from "./supabaseDb";
import { logTradeFromChart, updateLoggedTradeByRef } from "./tradeFlow";

const db = createSupabaseDb(createExtensionClient());

void appendLog("sw-boot");

async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(REFRESH_ALARM_NAME);
  if (!existing) {
    await chrome.alarms.create(REFRESH_ALARM_NAME, { periodInMinutes: REFRESH_ALARM_MINUTES });
  }
}
chrome.runtime.onInstalled.addListener(() => void ensureAlarm());
chrome.runtime.onStartup.addListener(() => void ensureAlarm());
void ensureAlarm();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== REFRESH_ALARM_NAME) return;
  void (async () => {
    const session = await db.getSessionInfo();
    if (!session) return; // niets te verversen — stil blijven
    const { error } = await db.refreshSession();
    await appendLog("alarm-refresh", error ?? "ok");
  })();
});

async function handle(req: ExtRequest): Promise<ExtResponses[ExtRequest["type"]]> {
  switch (req.type) {
    case "status":
      return getStatus(db);
    case "link": {
      const result = await linkWithToken(db, req.tokenHash);
      await appendLog("link", result.ok ? result.email : result.error);
      return result;
    }
    case "unlink":
      await db.signOutLocal();
      await appendLog("unlink");
      return { ok: true };
    case "journal-dump":
      return fetchJournalDump(db);
    case "diag-log":
      return { entries: await readLog() };
    case "chart-state":
      return readChartState();
    case "targets": {
      const session = await db.getSessionInfo();
      if (!session) return { ok: false, error: "Niet gekoppeld" };
      const profile = await db.getProfile(session.userId);
      const [journals, projects] = await Promise.all([db.listJournals(), db.listBacktestProjects()]);
      return {
        ok: true,
        activeJournalId: profile?.methodologyId ?? null,
        journals,
        projects,
        hideFase: profile?.hideFase === true,
        // Zelfde fallback als de sessie-trigger in de DB (schema.sql).
        timezone: profile?.timezone ?? "Europe/Brussels",
      };
    }
    case "custom-options": {
      const session = await db.getSessionInfo();
      if (!session) return { ok: false, error: "Niet gekoppeld" };
      const [entry, tradeConcept] = await Promise.all([
        db.listCustomOptions("entry"),
        db.listCustomOptions("trade_concept"),
      ]);
      return { ok: true, entry, tradeConcept };
    }
    case "log-trade": {
      const result = await logTradeFromChart(db, req.request);
      await appendLog("log-trade", result.ok ? `ok${result.duplicate ? " (duplicate)" : ""}` : `${result.stage}: ${result.error}`);
      return result;
    }
    case "snapshot-cycle":
      return snapshotCycle(req.slots);
    case "delete-screenshots":
      await db.removeScreenshots(req.paths.filter((p) => typeof p === "string" && p.length < 200));
      return { ok: true };
    case "open-trades":
      return listOpenTradesForSymbol(db, req.symbolRaw);
    case "close-trade": {
      const result = await closeTradeFromChart(db, req.request);
      await appendLog("close-trade", result.ok ? `ok ${result.outcome} ${result.resultaatPct}%` : `${result.stage}: ${result.error}`);
      return result;
    }
    case "update-trade": {
      const result = await updateLoggedTradeByRef(db, req.request);
      await appendLog("update-trade", result.ok ? "ok" : `${result.stage}: ${result.error}`);
      return result;
    }
  }
}

async function findChartTab(): Promise<chrome.tabs.Tab | undefined> {
  const isChartTab = (t: chrome.tabs.Tab | undefined) =>
    !!t?.id && !!t.url && /^https:\/\/([^/]+\.)?tradingview\.com\/chart\//.test(t.url); // geen lookalike-suffixdomeinen
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isChartTab(active)) return active;
  const candidates = await chrome.tabs.query({ url: "https://*.tradingview.com/chart/*" });
  return candidates.find(isChartTab);
}

/** F3a: de W/D/4H/2H-cyclus met echte Chrome/TV/Supabase-deps rond de pure
 * runSnapshotCycle. Fouten per slot; het oorspronkelijke timeframe wordt
 * altijd hersteld (garantie uit runSnapshotCycle zelf). */
async function snapshotCycle(slots: SnapshotSlot[]): Promise<ExtResponses["snapshot-cycle"]> {
  const tab = await findChartTab();
  if (!tab?.id) return { ok: false, error: "Geen open TradingView-chart-tab gevonden" };
  const tabId = tab.id;
  const windowId = tab.windowId;

  // Primair beeld-pad: TV's eigen takeClientScreenshot via de page-world —
  // chart-only canvas, geen activeTab-gebaar, geen crop. Elke afwijking
  // (oude TV-build, drift, timeout) valt terug op captureVisibleTab + crop,
  // waar de S0-gebaar-beperking nog wél geldt.
  async function capture(): Promise<CaptureResult> {
    try {
      const shot: unknown = await chrome.tabs.sendMessage(tabId, { type: "tv-page-screenshot" });
      const s = typeof shot === "object" && shot !== null ? (shot as { ok?: unknown; dataUrl?: unknown; error?: unknown }) : null;
      if (s?.ok === true && typeof s.dataUrl === "string" && s.dataUrl.startsWith("data:image/png")) {
        return { ok: true, image: await (await fetch(s.dataUrl)).blob() };
      }
      await appendLog("snapshot-page-shot-degraded", typeof s?.error === "string" ? s.error : "onbruikbaar antwoord");
    } catch (e) {
      await appendLog("snapshot-page-shot-degraded", String((e instanceof Error && e.message) || e));
    }
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
      const full = await (await fetch(dataUrl)).blob();
      const rect: unknown = await chrome.tabs.sendMessage(tabId, { type: "tv-chart-rect" });
      const r = typeof rect === "object" && rect !== null ? (rect as Partial<ChartRect>) : null;
      if (!r || [r.x, r.y, r.w, r.h, r.dpr].some((v) => typeof v !== "number")) {
        return { ok: false, error: "chart-rect onbepaalbaar" };
      }
      return { ok: true, image: await cropToRect(full, r as ChartRect) };
    } catch (e) {
      const msg = String((e instanceof Error && e.message) || e);
      return isGestureError(msg) ? { ok: false, error: msg, code: "needs-gesture" } : { ok: false, error: msg };
    }
  }

  const deps: SnapshotDeps = {
    async getResolution() {
      const payload: unknown = await chrome.tabs.sendMessage(tabId, { type: "tv-page-read" });
      const state = parseChartState(payload);
      return state.resolution.ok ? state.resolution.value : null;
    },
    async setResolution(resolution) {
      const res: unknown = await chrome.tabs.sendMessage(tabId, { type: "tv-page-set-resolution", resolution });
      return typeof res === "object" && res !== null && (res as { ok?: unknown }).ok === true;
    },
    capture,
    upload: (image) => db.uploadScreenshot(image),
    settle: () => new Promise((resolve) => setTimeout(resolve, 1500)),
    thumbnail: thumbnailDataUrl,
  };

  try {
    const result = await runSnapshotCycle(deps, slots);
    const failed = Object.entries(result.slots).filter(([, r]) => r && !r.ok);
    if (failed.length > 0) await appendLog("snapshot-degraded", failed.map(([s, r]) => `${s}: ${r && !r.ok ? r.error : ""}`).join(" | "));
    return { ok: true, ...result };
  } catch (e) {
    const detail = String((e instanceof Error && e.message) || e);
    await appendLog("snapshot-error", detail);
    return { ok: false, error: detail };
  }
}

/** Vraag de bridge op een open TV-chart-tab om de chart-state en parseer die
 * over de vertrouwensgrens heen (F2a). Actieve tab eerst, anders de eerste
 * TV-chart-tab; leesfouten gaan het diagnose-log in (telemetrie-haak F4a). */
async function readChartState(): Promise<ExtResponses["chart-state"]> {
  const tab = await findChartTab();
  if (!tab?.id) return { ok: false, error: "Geen open TradingView-chart-tab gevonden" };
  try {
    const payload: unknown = await chrome.tabs.sendMessage(tab.id, { type: "tv-page-read" });
    const state = parseChartState(payload);
    const failures = [state.symbol, state.resolution, state.tick, state.positions]
      .filter((r) => !r.ok)
      .map((r) => (r.ok ? "" : r.reason));
    if (failures.length > 0) await appendLog("chart-read-degraded", failures.join(" | "));
    return { ok: true, state };
  } catch (e) {
    const detail = String((e instanceof Error && e.message) || e);
    await appendLog("chart-read-error", detail);
    return { ok: false, error: "Chart-tab antwoordt niet — herlaad de TradingView-pagina" };
  }
}

chrome.runtime.onMessage.addListener((msg: ExtRequest, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      void appendLog("error", detail);
      sendResponse({ ok: false, error: "Er ging iets mis — zie het diagnose-log" });
    });
  return true; // async sendResponse
});
