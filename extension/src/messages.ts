// Berichtenschema popup ⇄ service worker. Eén union voor requests en een
// type-map voor de bijbehorende responses; popup.ts krijgt daarmee end-to-end
// types zonder casts in de call-sites.
import type { ChartState } from "./adapter/parse";
import type { FlowError, JournalDump, LinkOk, StatusInfo } from "./linkFlow";
import type { LogEntry } from "./storage";

export type ExtRequest =
  | { type: "status" }
  | { type: "link"; tokenHash: string }
  | { type: "unlink" }
  | { type: "journal-dump" }
  | { type: "diag-log" }
  | { type: "chart-state" };

export interface ExtResponses {
  status: StatusInfo;
  link: LinkOk | FlowError;
  unlink: { ok: true };
  "journal-dump": JournalDump | FlowError;
  "diag-log": { entries: LogEntry[] };
  "chart-state": { ok: true; state: ChartState } | FlowError;
}

export function sendToSw<T extends ExtRequest["type"]>(
  req: Extract<ExtRequest, { type: T }>
): Promise<ExtResponses[T]> {
  return chrome.runtime.sendMessage(req);
}
