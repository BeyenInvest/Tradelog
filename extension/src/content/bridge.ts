// Isolated-world bridge (F2a): relayt verzoeken van de service worker/popup
// naar het MAIN-world script en de (onbetrouwbare) antwoorden terug. Valideert
// alleen de ENVELOPE; de payload wordt pas typed in parse.ts aan de extensie-kant.
// Gebundeld als IIFE.
import { isPageResponse, makeRequest, type PageCommand } from "../adapter/protocol";

const PAGE_TIMEOUT_MS = 3000;
/** Screenshot rendert een canvas van de hele chart — gun 'm meer tijd dan een leesactie. */
const SCREENSHOT_TIMEOUT_MS = 10_000;
/** De snapshot-settle pollt page-side tot max READY_TIMEOUT_MS (5 s) + paint-
 * settle; de bridge-timeout moet daar ruim boven zitten om het antwoord niet
 * te "verliezen" terwijl het nog onderweg is. */
const WAIT_READY_TIMEOUT_MS = 6500;

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

function askPage(command: PageCommand, timeoutMs = PAGE_TIMEOUT_MS): Promise<unknown> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      pending.delete(id);
      resolve({ bridgeTimeout: true });
    }, timeoutMs);
    pending.set(id, { resolve, timer });
    window.postMessage(makeRequest(id, command), location.origin);
  });
}

interface BridgeMessage {
  type?: unknown;
  resolution?: unknown;
}

/** Chart-container-rect voor de snapshot-crop (F3a). Zelfde selector-ladder als
 * de S0-spike; viewport-fallback zodat een TV-DOM-wijziging degradeert i.p.v.
 * crasht (de crop wordt dan ruimer, nooit fout gepositioneerd). */
function measureChartRect(): { x: number; y: number; w: number; h: number; dpr: number; selector: string } {
  for (const selector of [".chart-container.active", ".chart-container", ".chart-markup-table", ".layout__area--center"]) {
    const el = document.querySelector(selector);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 200 && r.height > 200) {
        return { x: r.x, y: r.y, w: r.width, h: r.height, dpr: window.devicePixelRatio || 1, selector };
      }
    }
  }
  return { x: 0, y: 0, w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio || 1, selector: "viewport-fallback" };
}

chrome.runtime.onMessage.addListener((msg: BridgeMessage, _sender, sendResponse) => {
  if (msg?.type === "tv-page-read") {
    void askPage({ cmd: "read-state" }).then(sendResponse);
    return true;
  }
  if (msg?.type === "tv-page-set-resolution" && typeof msg.resolution === "string") {
    void askPage({ cmd: "set-resolution", resolution: msg.resolution }).then(sendResponse);
    return true;
  }
  if (msg?.type === "tv-page-wait-ready" && typeof msg.resolution === "string") {
    void askPage({ cmd: "wait-chart-ready", resolution: msg.resolution }, WAIT_READY_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  if (msg?.type === "tv-chart-rect") {
    sendResponse(measureChartRect());
    return false;
  }
  if (msg?.type === "tv-page-screenshot") {
    void askPage({ cmd: "take-screenshot" }, SCREENSHOT_TIMEOUT_MS).then(sendResponse);
    return true;
  }
  return false;
});
