// Berichtenschema over de page-world-grens (F2a, plan §2.3). Dit is een
// VERTROUWENSGRENS: alles wat uit de page-world komt is onbetrouwbare input en
// wordt pas typed nadat parse.ts het gevalideerd heeft. De envelope zelf wordt
// hier strikt gecheckt (source-tag + richting + id), de payload blijft unknown.

export const ENVELOPE_SOURCE = "beyen-tv-ext";

export type PageCommand =
  | { cmd: "read-state" }
  | { cmd: "set-resolution"; resolution: string };

export interface PageRequestEnvelope {
  source: typeof ENVELOPE_SOURCE;
  dir: "req";
  id: string;
  command: PageCommand;
}

export interface PageResponseEnvelope {
  source: typeof ENVELOPE_SOURCE;
  dir: "res";
  id: string;
  /** Onbetrouwbaar tot parse.ts erover ging. */
  payload: unknown;
}

export function makeRequest(id: string, command: PageCommand): PageRequestEnvelope {
  return { source: ENVELOPE_SOURCE, dir: "req", id, command };
}

export function makeResponse(id: string, payload: unknown): PageResponseEnvelope {
  return { source: ENVELOPE_SOURCE, dir: "res", id, payload };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isPageRequest(v: unknown): v is PageRequestEnvelope {
  if (!isRecord(v) || v.source !== ENVELOPE_SOURCE || v.dir !== "req" || typeof v.id !== "string") return false;
  const c = v.command;
  if (!isRecord(c)) return false;
  if (c.cmd === "read-state") return true;
  if (c.cmd === "set-resolution") return typeof c.resolution === "string" && c.resolution.length > 0 && c.resolution.length < 16;
  return false;
}

export function isPageResponse(v: unknown): v is PageResponseEnvelope {
  return isRecord(v) && v.source === ENVELOPE_SOURCE && v.dir === "res" && typeof v.id === "string" && "payload" in v;
}

/** Uniform degradatie-contract van elke lezer (plan §2.3): nooit een stil
 * verkeerde waarde — óf een waarde, óf een reden voor "vul handmatig in". */
export type Reading<T> = { ok: true; value: T } | { ok: false; reason: string };

export function ok<T>(value: T): Reading<T> {
  return { ok: true, value };
}

export function fail<T>(reason: string): Reading<T> {
  return { ok: false, reason };
}
