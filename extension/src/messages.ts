// Berichtenschema popup ⇄ service worker. Eén union voor requests en een
// type-map voor de bijbehorende responses; popup.ts krijgt daarmee end-to-end
// types zonder casts in de call-sites.
import type { ChartState } from "./adapter/parse";
import type { CloseTradeRequest, CloseTradeResult, OpenTradesResult } from "./closeFlow";
import type { BacktestProjectInfo, JournalInfo } from "./db";
import type { FlowError, JournalDump, LinkOk, StatusInfo } from "./linkFlow";
import type { LogEntry } from "./storage";
import type { SnapshotCycleResult, SnapshotSlot } from "./snapshots";
import type { LogTradeRequest, LogTradeResult } from "./tradeFlow";

export type ExtRequest =
  | { type: "status" }
  | { type: "link"; tokenHash: string }
  | { type: "unlink" }
  | { type: "journal-dump" }
  | { type: "diag-log" }
  | { type: "chart-state" }
  | { type: "targets" }
  | { type: "log-trade"; request: LogTradeRequest }
  | {
      type: "snapshot-cycle";
      slots: SnapshotSlot[];
      /** Journal-eigen TF per slot (screenshot_timeframes, 0061); weggelaten =
       * de vaste W/D/4H/2H-defaults. De SW valideert elke waarde tegen de
       * gedeelde whitelist (trust boundary) vóór hij naar TV gaat. */
      resolutions?: Record<SnapshotSlot, string>;
    }
  | { type: "delete-screenshots"; paths: string[] }
  | { type: "open-trades"; symbolRaw: string }
  | { type: "close-trade"; request: CloseTradeRequest }
  | { type: "update-trade"; request: LogTradeRequest };

export interface TargetsInfo {
  ok: true;
  activeJournalId: string | null;
  journals: JournalInfo[];
  projects: BacktestProjectInfo[];
  /** profiles.timezone (IANA) — het paneel leidt er o.a. de CC-prefill uit af. */
  timezone: string;
}

export interface ExtResponses {
  status: StatusInfo;
  link: LinkOk | FlowError;
  unlink: { ok: true };
  "journal-dump": JournalDump | FlowError;
  "diag-log": { entries: LogEntry[] };
  "chart-state": { ok: true; state: ChartState } | FlowError;
  targets: TargetsInfo | FlowError;
  "log-trade": LogTradeResult;
  "snapshot-cycle": ({ ok: true } & SnapshotCycleResult) | FlowError;
  "delete-screenshots": { ok: true };
  "open-trades": OpenTradesResult;
  "close-trade": CloseTradeResult;
  "update-trade": LogTradeResult;
}

export function sendToSw<T extends ExtRequest["type"]>(
  req: Extract<ExtRequest, { type: T }>
): Promise<ExtResponses[T]> {
  return chrome.runtime.sendMessage(req);
}
