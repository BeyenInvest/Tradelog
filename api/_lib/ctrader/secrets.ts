// Server-only crypto voor de broker-koppeling (plan-ctrader-sync §3).
//
// - OAuth-state: HMAC-gesigneerde, kortlevende payload (user + vervaltijd). De
//   cTrader-callback is een top-level navigatie zonder Supabase-JWT, dus de state
//   is het enige bewijs van wie de koppeling startte — onvervalsbaar via HMAC.
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
}

export function signState(state: OAuthState, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify({ u: state.userId, e: state.exp, n: b64url(randomBytes(8)) })));
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
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u?: unknown; e?: unknown };
    if (typeof parsed.u !== "string" || typeof parsed.e !== "number") return null;
    if (parsed.e < now) return null;
    return { userId: parsed.u, exp: parsed.e };
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
