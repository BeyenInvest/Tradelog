import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project values."
  );
}

/**
 * The `type` param (invite/recovery/signup/...) from the auth redirect URL, captured before
 * `createClient()` below processes and strips it. Supabase's client only fires a dedicated
 * `PASSWORD_RECOVERY` event for `type=recovery` — an invite link fires a plain `SIGNED_IN`,
 * indistinguishable from an ordinary login unless we read this ourselves. useAuth.tsx uses it
 * to catch invited users and force them through the same "set a password" gate as recovery,
 * since an invite session otherwise has no password at all.
 */
export const pendingAuthRedirectType =
  typeof window !== "undefined"
    ? (new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") ?? new URLSearchParams(window.location.search).get("type"))
    : null;

export const supabase = createClient(url, anonKey);
