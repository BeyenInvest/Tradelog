// MV3 service worker — auth-eigenaar van de extensie (plan §2.6). Houdt de
// Supabase-sessie in chrome.storage, ververst via chrome.alarms en beantwoordt
// popup-berichten. Geen writes naar trades in F1b.
import { REFRESH_ALARM_MINUTES, REFRESH_ALARM_NAME } from "./config";
import type { ExtRequest, ExtResponses } from "./messages";
import { fetchJournalDump, getStatus, linkWithToken } from "./linkFlow";
import { appendLog, readLog } from "./storage";
import { createExtensionClient, createSupabaseDb } from "./supabaseDb";

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
