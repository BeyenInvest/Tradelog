// MV3 service worker — auth-eigenaar van de extensie (plan §2.6). Houdt de
// Supabase-sessie in chrome.storage, ververst via chrome.alarms en beantwoordt
// popup-berichten. Geen writes naar trades in F1b.
import { parseChartState } from "./adapter/parse";
import { REFRESH_ALARM_MINUTES, REFRESH_ALARM_NAME } from "./config";
import type { ExtRequest, ExtResponses } from "./messages";
import { fetchJournalDump, getStatus, linkWithToken } from "./linkFlow";
import { appendLog, readLog } from "./storage";
import { createExtensionClient, createSupabaseDb } from "./supabaseDb";
import { logTradeFromChart } from "./tradeFlow";

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
      return { ok: true, activeJournalId: profile?.methodologyId ?? null, journals, projects };
    }
    case "log-trade": {
      const result = await logTradeFromChart(db, req.request);
      await appendLog("log-trade", result.ok ? `ok${result.duplicate ? " (duplicate)" : ""}` : `${result.stage}: ${result.error}`);
      return result;
    }
  }
}

/** Vraag de bridge op een open TV-chart-tab om de chart-state en parseer die
 * over de vertrouwensgrens heen (F2a). Actieve tab eerst, anders de eerste
 * TV-chart-tab; leesfouten gaan het diagnose-log in (telemetrie-haak F4a). */
async function readChartState(): Promise<ExtResponses["chart-state"]> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isChartTab = (t: chrome.tabs.Tab | undefined) =>
    !!t?.id && !!t.url && /^https:\/\/[^/]*tradingview\.com\/chart\//.test(t.url);
  let tab = isChartTab(active) ? active : undefined;
  if (!tab) {
    const candidates = await chrome.tabs.query({ url: "https://*.tradingview.com/chart/*" });
    tab = candidates.find(isChartTab);
  }
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
