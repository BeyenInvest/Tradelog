// Gedeelde server-config voor api/ctrader.ts en api/ctrader-callback.ts.
// Env-vars: zie docs/plan-ctrader-sync.md §5.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CtraderAppConfig } from "./sync.js";

export function readAppConfig(): { cfg: CtraderAppConfig; secret: string; admin: SupabaseClient } {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientId = process.env.CTRADER_CLIENT_ID;
  const clientSecret = process.env.CTRADER_CLIENT_SECRET;
  const redirectUri = process.env.CTRADER_REDIRECT_URI;
  const secret = process.env.BROKER_TOKEN_SECRET;
  if (!url || !secretKey || !clientId || !clientSecret || !redirectUri || !secret || secret.length < 32) {
    throw new Error("cTrader/Supabase-env onvolledig (zie docs/plan-ctrader-sync.md §5)");
  }
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { cfg: { clientId, clientSecret, redirectUri }, secret, admin };
}
