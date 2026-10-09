// cTrader Open API — JSON-over-WebSocket client (plan-ctrader-sync §2).
//
// Elke request draagt een eigen clientMsgId; de response met hetzelfde id lost
// de promise op. Fouten (ProtoOAErrorRes / ProtoErrorRes) worden een rejected
// promise met de cTrader-errorCode erin. Heartbeats houden de verbinding open
// tijdens een lange (gechunkte) deal-fetch.
//
// Host: live.ctraderapi.com / demo.ctraderapi.com, poort 5036 = JSON (5035 is
// protobuf). Demo- en live-accounts zitten op gescheiden endpoints.

export const PT = {
  HEARTBEAT: 51,
  ERROR_RES: 50,
  APPLICATION_AUTH_REQ: 2100,
  APPLICATION_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102,
  ACCOUNT_AUTH_RES: 2103,
  SYMBOLS_LIST_REQ: 2114,
  SYMBOLS_LIST_RES: 2115,
  TRADER_REQ: 2121,
  TRADER_RES: 2122,
  RECONCILE_REQ: 2124,
  RECONCILE_RES: 2125,
  DEAL_LIST_REQ: 2133,
  DEAL_LIST_RES: 2134,
  OA_ERROR_RES: 2142,
  GET_ACCOUNTS_BY_TOKEN_REQ: 2149,
  GET_ACCOUNTS_BY_TOKEN_RES: 2150,
  DEAL_LIST_BY_POSITION_REQ: 2179,
  DEAL_LIST_BY_POSITION_RES: 2180,
} as const;

export class CtraderApiError extends Error {
  constructor(
    public readonly errorCode: string,
    description: string | undefined
  ) {
    super(`cTrader ${errorCode}${description ? `: ${description}` : ""}`);
  }
}

export interface CtraderSession {
  request<T = Record<string, unknown>>(payloadType: number, payload: Record<string, unknown>): Promise<T>;
  close(): void;
}

type WsLike = {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "message" | "error" | "close", cb: (ev: { data?: unknown }) => void): void;
};

export type WsFactory = (url: string) => WsLike;

const REQUEST_TIMEOUT_MS = 20_000;
const HEARTBEAT_MS = 10_000;

export function hostFor(isLive: boolean): string {
  return `wss://${isLive ? "live" : "demo"}.ctraderapi.com:5036`;
}

export function defaultWsFactory(url: string): WsLike {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => WsLike }).WebSocket;
  if (!Ctor) throw new Error("Geen WebSocket in deze runtime (Node 22+ vereist)");
  return new Ctor(url);
}

export function openSession(isLive: boolean, wsFactory: WsFactory = defaultWsFactory): Promise<CtraderSession> {
  return new Promise((resolve, reject) => {
    const ws = wsFactory(hostFor(isLive));
    const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    let seq = 0;
    let opened = false;
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    function failAll(err: Error) {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(err);
      }
      pending.clear();
    }

    function close() {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      failAll(new Error("cTrader-verbinding gesloten"));
      try {
        ws.close();
      } catch {
        /* al dicht */
      }
    }

    ws.addEventListener("open", () => {
      opened = true;
      heartbeat = setInterval(() => {
        try {
          ws.send(JSON.stringify({ payloadType: PT.HEARTBEAT, payload: {} }));
        } catch {
          /* close-handler ruimt op */
        }
      }, HEARTBEAT_MS);
      resolve({
        request<T>(payloadType: number, payload: Record<string, unknown>) {
          if (closed) return Promise.reject(new Error("cTrader-verbinding gesloten"));
          const clientMsgId = `b${++seq}`;
          return new Promise<T>((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(clientMsgId);
              rej(new Error(`cTrader-timeout op payloadType ${payloadType}`));
            }, REQUEST_TIMEOUT_MS);
            pending.set(clientMsgId, { resolve: res as (v: unknown) => void, reject: rej, timer });
            ws.send(JSON.stringify({ clientMsgId, payloadType, payload }));
          });
        },
        close,
      });
    });

    ws.addEventListener("message", (ev) => {
      let msg: { clientMsgId?: string; payloadType?: number; payload?: Record<string, unknown> };
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (!msg.clientMsgId) return; // heartbeat / events
      const p = pending.get(msg.clientMsgId);
      if (!p) return;
      pending.delete(msg.clientMsgId);
      clearTimeout(p.timer);
      const payload = msg.payload ?? {};
      if (msg.payloadType === PT.OA_ERROR_RES || msg.payloadType === PT.ERROR_RES) {
        p.reject(new CtraderApiError(String(payload.errorCode ?? "UNKNOWN"), payload.description as string | undefined));
      } else {
        p.resolve(payload);
      }
    });

    ws.addEventListener("error", () => {
      if (!opened) reject(new Error("Kon geen verbinding maken met cTrader"));
      close();
    });
    ws.addEventListener("close", () => {
      if (!opened) reject(new Error("cTrader-verbinding geweigerd"));
      close();
    });
  });
}
