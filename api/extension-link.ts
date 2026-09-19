// F1a — koppel-endpoint voor de TradingView-extensie (plan-tv-extensie-engines §2.2, variant A).
//
// De ingelogde web-app roept dit aan met de eigen Supabase-JWT in de
// Authorization-header. Het endpoint verifieert die JWT server-side en geeft één
// kortlevende, eenmalige magiclink token_hash terug (open voor alle leden sinds de
// extensie un-gate is, owner-besluit 2026-09-19). De extensie wisselt die via
// verifyOtp({ token_hash, type: 'magiclink' }) in voor een eigen sessie met een
// eigen refresh-token-familie (bewezen in de S0-spike, docs/spike-tv-extensie.md).
//
// Securitygrenzen:
// - Het e-mailadres komt uitsluitend uit de geverifieerde JWT — nooit uit de
//   request-body, dus een token kan alleen voor de aanroeper zelf worden gemaakt.
// - De secret key (SUPABASE_SECRET_KEY) bestaat alleen als server-side Vercel-env
//   en verlaat deze functie nooit; de response bevat uitsluitend de token_hash.
// - Geen CORS-headers: alleen de eigen app-origin (same-origin fetch) kan dit
//   endpoint vanuit een browser aanroepen; de extensie krijgt de code via de app-UI.

import { createClient } from "@supabase/supabase-js";

interface VercelStyleRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelStyleResponse {
  status(code: number): VercelStyleResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export interface ExtensionLinkDeps {
  /** Valideert de JWT bij Supabase; null bij ongeldig/verlopen token. */
  getUserFromJwt(jwt: string): Promise<{ id: string; email: string } | null>;
  /** admin.generateLink(magiclink) → properties.hashed_token. */
  generateLinkTokenHash(email: string): Promise<string>;
  now?(): number;
}

// Best-effort rate-limit per warme serverless-instance (geen gedeelde store, dus
// geen harde garantie over meerdere instances — acceptabel: het endpoint zit al
// achter auth en de tokens zijn eenmalig + kortlevend). Bewuste keuze i.p.v. een
// extra tabel/migratie; heroverwegen bij misbruik-signalen in F4a.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export function createHandler(
  deps: ExtensionLinkDeps,
  requestLog: Map<string, number[]> = new Map()
) {
  const now = deps.now ?? Date.now;

  return async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
    res.setHeader("cache-control", "no-store");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Alleen POST" });
      return;
    }

    const authHeader = req.headers["authorization"];
    const bearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;
    if (!bearer) {
      res.status(401).json({ error: "Geen geldige Authorization-header" });
      return;
    }

    try {
      const user = await deps.getUserFromJwt(bearer);
      if (!user) {
        res.status(401).json({ error: "Sessie ongeldig of verlopen" });
        return;
      }

      const windowStart = now() - RATE_LIMIT_WINDOW_MS;
      const recent = (requestLog.get(user.id) ?? []).filter((t) => t > windowStart);
      if (recent.length >= RATE_LIMIT_MAX) {
        requestLog.set(user.id, recent);
        res.status(429).json({ error: "Te veel koppelverzoeken — probeer het over een paar minuten opnieuw" });
        return;
      }
      requestLog.set(user.id, [...recent, now()]);

      const tokenHash = await deps.generateLinkTokenHash(user.email);
      res.status(200).json({ token_hash: tokenHash });
    } catch (err) {
      // Bewust generiek naar de client; details alleen server-side loggen.
      console.error("extension-link:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "Koppelen mislukt — probeer het later opnieuw" });
    }
  };
}

function buildRealDeps(): ExtensionLinkDeps {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL/SUPABASE_SECRET_KEY ontbreken in de server-env");
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    async getUserFromJwt(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data.user || !data.user.email) return null;
      return { id: data.user.id, email: data.user.email };
    },
    async generateLinkTokenHash(email) {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error) throw new Error(`generateLink: ${error.message}`);
      const tokenHash = data.properties?.hashed_token;
      if (!tokenHash) throw new Error("generateLink gaf geen hashed_token terug");
      return tokenHash;
    },
  };
}

let realHandler: ReturnType<typeof createHandler> | null = null;

export default async function handler(req: VercelStyleRequest, res: VercelStyleResponse) {
  try {
    if (!realHandler) realHandler = createHandler(buildRealDeps());
  } catch (err) {
    console.error("extension-link (config):", err instanceof Error ? err.message : err);
    res.setHeader("cache-control", "no-store");
    res.status(500).json({ error: "Server niet geconfigureerd" });
    return;
  }
  return realHandler(req, res);
}
