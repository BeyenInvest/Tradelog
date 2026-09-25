// MV3 service worker — auth-eigenaar van de extensie (plan §2.6). Houdt de
// Supabase-sessie in chrome.storage, ververst via chrome.alarms en beantwoordt
// popup-berichten. Geen writes naar trades in F1b.
import { parseChartState } from "./adapter/parse";
import { REFRESH_ALARM_MINUTES, REFRESH_ALARM_NAME } from "./config";
import type { ExtRequest, ExtResponses } from "./messages";
import { fetchJournalDump, getStatus, linkWithToken } from "./linkFlow";
import { isSnapshotTimeframe } from "../../src/lib/screenshotSlots";
import {
  cropToRect, isGestureError, runSnapshotCycle, SLOT_RESOLUTIONS, SNAPSHOT_SLOTS, thumbnailDataUrl,
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

async function handle(req: ExtRequest, sender: chrome.runtime.MessageSender): Promise<ExtResponses[ExtRequest["type"]]> {
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
      return readChartState(sender);
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
        // Zelfde fallback als de sessie-trigger in de DB (schema.sql).
        timezone: profile?.timezone ?? "Europe/Brussels",
      };
    }
    case "log-trade": {
      const result = await logTradeFromChart(db, req.request);
      await appendLog("log-trade", result.ok ? `ok${result.duplicate ? " (duplicate)" : ""}` : `${result.stage}: ${result.error}`);
      return result;
    }
    case "snapshot-cycle":
      return snapshotCycle(req.slots, req.resolutions, sender);
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

function isChartTab(t: chrome.tabs.Tab | undefined): t is chrome.tabs.Tab {
  return !!t?.id && !!t.url && /^https:\/\/([^/]+\.)?tradingview\.com\/chart\//.test(t.url); // geen lookalike-suffixdomeinen
}

async function findChartTab(): Promise<chrome.tabs.Tab | undefined> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isChartTab(active)) return active;
  const candidates = await chrome.tabs.query({ url: "https://*.tradingview.com/chart/*" });
  return candidates.find(isChartTab);
}

/** D3: het paneel leeft ín de chart-tab, dus die tab is per definitie de juiste
 * — sender.tab wint. findChartTab (raad-de-tab) blijft alleen als fallback voor
 * de popup, die geen tab-context heeft. */
async function resolveChartTab(sender: chrome.runtime.MessageSender): Promise<chrome.tabs.Tab | undefined> {
  if (isChartTab(sender.tab)) return sender.tab;
  return findChartTab();
}

/** Trust boundary rond de door het paneel aangeleverde slot-TF's (0061): het
 * content-script-bericht is onvertrouwd, dus alleen whitelist-waarden komen
 * door — al het andere valt stil terug op de default van dat slot. Er gaat
 * nooit een vrije string naar TV's setResolution. */
function sanitizeResolutions(raw: Record<SnapshotSlot, string> | undefined): Record<SnapshotSlot, string> {
  const out = { ...SLOT_RESOLUTIONS };
  if (typeof raw !== "object" || raw === null) return out;
  for (const slot of SNAPSHOT_SLOTS) {
    const v = raw[slot];
    if (isSnapshotTimeframe(v)) out[slot] = v;
  }
  return out;
}

/** F3a: de snapshot-cyclus (slot-TF's uit het journal, 0061; default W/D/4H/2H)
 * met echte Chrome/TV/Supabase-deps rond de pure runSnapshotCycle. Fouten per
 * slot; het oorspronkelijke timeframe wordt altijd hersteld (garantie uit
 * runSnapshotCycle zelf). */
async function snapshotCycle(
  slots: SnapshotSlot[],
  resolutions: Record<SnapshotSlot, string> | undefined,
  sender: chrome.runtime.MessageSender
): Promise<ExtResponses["snapshot-cycle"]> {
  const tab = await resolveChartTab(sender);
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
      // D2: captureVisibleTab pakt wat er in het venster ZICHTBAAR is — dat is
      // alleen onze chart als de chart-tab nog echt de actieve tab is. De user
      // kan tijdens de cyclus van tab gewisseld zijn; dan afbreken, nooit een
      // andere tab fotograferen (Store-claim "no other tab is ever captured").
      const [active] = await chrome.tabs.query({ active: true, windowId });
      if (active?.id !== tabId) {
        return { ok: false, error: "chart-tab is niet meer de actieve tab — capture afgebroken" };
      }
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
    // Echt wachten tot TV het nieuwe timeframe geladen+getekend heeft (page-
    // world pollt dataReady/laatste bar, cap 5 s) i.p.v. een blinde timer —
    // de Daily-capture pakte anders een nog-ladende chart. Degradeert altijd
    // richting "toch capturen": nooit slechter dan het oude gedrag.
    async settle(target) {
      try {
        const res: unknown = await chrome.tabs.sendMessage(tabId, { type: "tv-page-wait-ready", resolution: target });
        const r = typeof res === "object" && res !== null
          ? (res as { ok?: unknown; ready?: unknown; signal?: unknown; waitedMs?: unknown })
          : null;
        if (r?.ok === true && r.ready === true) return;
        // Timeout of onbruikbaar antwoord: page-side is al ruim gewacht.
        await appendLog("snapshot-settle-degraded", `signal=${String(r?.signal ?? "geen antwoord")}, waitedMs=${String(r?.waitedMs ?? "?")}`);
      } catch (e) {
        // Bericht kwam niet aan (oud content-script na een update?) → de oude
        // vaste wachttijd als vloer.
        await appendLog("snapshot-settle-degraded", String((e instanceof Error && e.message) || e));
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    },
    thumbnail: thumbnailDataUrl,
  };

  try {
    const result = await runSnapshotCycle(deps, slots, sanitizeResolutions(resolutions));
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
async function readChartState(sender: chrome.runtime.MessageSender): Promise<ExtResponses["chart-state"]> {
  const tab = await resolveChartTab(sender);
  if (!tab?.id) return { ok: false, error: "Geen open TradingView-chart-tab gevonden" };
  try {
    const payload: unknown = await chrome.tabs.sendMessage(tab.id, { type: "tv-page-read" });
    const state = parseChartState(payload);
    const failures = [state.symbol, state.resolution, state.tick, state.positions]
      .filter((r) => !r.ok)
      .map((r) => (r.ok ? "" : r.reason));
    if (failures.length > 0) await appendLog("chart-read-degraded", failures.join(" | "));
    // D4: onleesbare position-tools zichtbaar maken vóór gebruikersklachten.
    if (state.dropped.length > 0) {
      await appendLog("chart-shapes-dropped", state.dropped.map((d) => `${d.id}: ${d.reason}`).join(" | "));
    }
    return { ok: true, state };
  } catch (e) {
    const detail = String((e instanceof Error && e.message) || e);
    await appendLog("chart-read-error", detail);
    return { ok: false, error: "Chart-tab antwoordt niet — herlaad de TradingView-pagina" };
  }
}

chrome.runtime.onMessage.addListener((msg: ExtRequest, sender, sendResponse) => {
  handle(msg, sender)
    .then(sendResponse)
    .catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      void appendLog("error", detail);
      sendResponse({ ok: false, error: "Er ging iets mis — zie het diagnose-log" });
    });
  return true; // async sendResponse
});
