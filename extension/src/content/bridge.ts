// Isolated-world bridge (F2a): relayt verzoeken van de service worker/popup
// naar het MAIN-world script en de (onbetrouwbare) antwoorden terug. Valideert
// alleen de ENVELOPE; de payload wordt pas typed in parse.ts aan de extensie-kant.
// Gebundeld als IIFE.
import { isPageResponse, makeRequest, type PageCommand } from "../adapter/protocol";

const PAGE_TIMEOUT_MS = 3000;

const pending = new Map<string, { resolve: (payload: unknown) => void; timer: number }>();

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const data: unknown = ev.data;
  if (!isPageResponse(data)) return;
  const entry = pending.get(data.id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(data.id);
  entry.resolve(data.payload);
});

function askPage(command: PageCommand): Promise<unknown> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      pending.delete(id);
      resolve({ bridgeTimeout: true });
    }, PAGE_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    window.postMessage(makeRequest(id, command), location.origin);
  });
}

interface BridgeMessage {
  type?: unknown;
  resolution?: unknown;
}

chrome.runtime.onMessage.addListener((msg: BridgeMessage, _sender, sendResponse) => {
  if (msg?.type === "tv-page-read") {
    askPage({ cmd: "read-state" }).then(sendResponse);
    return true;
  }
  if (msg?.type === "tv-page-set-resolution" && typeof msg.resolution === "string") {
    askPage({ cmd: "set-resolution", resolution: msg.resolution }).then(sendResponse);
    return true;
  }
  return false;
});
