import { LOG_MAX_ENTRIES } from "./config";

/** supabase-js storage-adapter over chrome.storage.local — de MV3 service
 * worker heeft geen localStorage en sterft tussen events; chrome.storage
 * overleeft dat (runtime bewezen in de S0-spike). */
export const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const record = await chrome.storage.local.get(key);
    const value = record[key];
    return typeof value === "string" ? value : null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

export interface LogEntry {
  t: string;
  type: string;
  detail?: string;
}

// Serialiseer schrijfacties zodat parallelle events elkaars entries niet overschrijven.
let logChain: Promise<void> = Promise.resolve();

export function appendLog(type: string, detail?: string): Promise<void> {
  logChain = logChain
    .then(async () => {
      const { diagLog = [] } = (await chrome.storage.local.get("diagLog")) as { diagLog?: LogEntry[] };
      diagLog.push({ t: new Date().toISOString(), type, ...(detail ? { detail } : {}) });
      while (diagLog.length > LOG_MAX_ENTRIES) diagLog.shift();
      await chrome.storage.local.set({ diagLog });
    })
    .catch(() => {});
  return logChain;
}

export async function readLog(limit = 30): Promise<LogEntry[]> {
  const { diagLog = [] } = (await chrome.storage.local.get("diagLog")) as { diagLog?: LogEntry[] };
  return diagLog.slice(-limit);
}
