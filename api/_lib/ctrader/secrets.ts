// Server-only crypto voor de broker-koppeling (plan-ctrader-sync §3).
//
// - OAuth-state: HMAC-gesigneerde, kortlevende payload (user + vervaltijd + nonce).
//   De cTrader-callback is een top-level navigatie zonder Supabase-JWT; de state
//   bewijst wie de koppeling startte (onvervalsbaar via HMAC), de nonce bindt 'm
//   aan de browser die startte (cookie, zie OAUTH_COOKIE) — zonder die binding kan
//   iemand zijn eigen state-link naar een slachtoffer sturen en diens cTrader-
//   account onder zijn eigen Beyen-account laten koppelen.
// - Tokens: AES-256-GCM at rest in broker_connections, zodat een DB-dump/backup
//   alleen geen bruikbare cTrader-tokens oplevert.
// Beide sleutels zijn afgeleid van één env-secret (BROKER_TOKEN_SECRET) met een
// eigen label, zodat state-handtekening en token-sleutel nooit gelijk zijn.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function deriveKey(secret: string, label: string): Buffer {
  return createHash("sha256").update(`beyen:${label}:${secret}`).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export interface OAuthState {
  userId: string;
  /** Unix ms. */
  exp: number;
  /** Moet gelijk zijn aan de OAUTH_COOKIE-waarde in de callback. */
  nonce: string;
}

/** __Host-: alleen Secure, Path=/, geen Domain — niet te zetten vanaf een subdomein. */
export const OAUTH_COOKIE = "__Host-beyen_ctrader_oauth";

export function newNonce(): string {
  return b64url(randomBytes(16));
}

/** Leest één cookie uit een Cookie-header (null als afwezig). */
export function readCookie(header: string | string[] | undefined, name: string): string | null {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function nonceMatches(a: string | null, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signState(state: OAuthState, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ u: state.userId, e: state.exp, n: state.nonce })));
  const sig = b64url(createHmac("sha256", deriveKey(secret, "oauth-state")).update(body).digest());
  return `${body}.${sig}`;
}

/** Null bij een vervalste, kapotte of verlopen state. */
export function verifyState(token: string, secret: string, now: number = Date.now()): OAuthState | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", deriveKey(secret, "oauth-state")).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u?: unknown; e?: unknown; n?: unknown };
    if (typeof parsed.u !== "string" || typeof parsed.e !== "number" || typeof parsed.n !== "string") return null;
    if (parsed.e < now) return null;
    return { userId: parsed.u, exp: parsed.e, nonce: parsed.n };
  } catch {
    return null;
  }
}

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, "token"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${b64url(iv)}.${b64url(cipher.getAuthTag())}.${b64url(enc)}`;
}

export function decryptToken(blob: string, secret: string): string {
  const [version, iv, tag, enc] = blob.split(".");
  if (version !== "v1" || !iv || !tag || !enc) throw new Error("Onbekend token-formaat");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, "token"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
}
