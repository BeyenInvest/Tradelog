import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";
import type { ExtensionDb, JournalField } from "./db";
import { chromeStorageAdapter } from "./storage";

/** Eigen client met eigen refresh-token-familie — bewust géén sessie delen met
 * de web-app (rotatie zou beide uitloggen). autoRefreshToken uit: de refresh
 * loopt via chrome.alarms in sw.ts, want setInterval sterft met de MV3-SW. */
export function createExtensionClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseDb(client: SupabaseClient): ExtensionDb {
  return {
    async verifyLinkToken(tokenHash) {
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error || !data.user || !data.user.email) {
        return { user: null, error: error?.message };
      }
      return { user: { id: data.user.id, email: data.user.email } };
    },

    async signOutLocal() {
      await client.auth.signOut({ scope: "local" });
    },

    async getSessionInfo() {
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session || !session.user.email) return null;
      return {
        userId: session.user.id,
        email: session.user.email,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      };
    },

    async refreshSession() {
      const { error } = await client.auth.refreshSession();
      return error ? { error: error.message } : {};
    },

    async getProfile(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("beta_features, role, methodology_id, timezone")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        beta: data.beta_features === true || data.role === "admin",
        methodologyId: data.methodology_id ?? null,
        timezone: data.timezone,
      };
    },

    async getJournalSchema(methodologyId) {
      const { data: journal, error: journalErr } = await client
        .from("methodologies")
        .select("id, naam, asset_class, track_exit")
        .eq("id", methodologyId)
        .maybeSingle();
      if (journalErr || !journal) return null;

      const { data: fields, error: fieldsErr } = await client
        .from("methodology_fields")
        .select("field_key, label, label_key, field_type, options, required, is_computed, group_label, sort_order")
        .eq("methodology_id", methodologyId)
        .order("sort_order", { ascending: true });
      if (fieldsErr) return null;

      const mapped: JournalField[] = (fields ?? []).map((f) => ({
        fieldKey: f.field_key,
        label: f.label,
        labelKey: f.label_key ?? null,
        fieldType: f.field_type,
        options: f.options,
        required: f.required === true,
        isComputed: f.is_computed === true,
        groupLabel: f.group_label ?? null,
        sortOrder: f.sort_order,
      }));

      return {
        id: journal.id,
        naam: journal.naam,
        assetClass: journal.asset_class ?? null,
        trackExit: journal.track_exit === true,
        fields: mapped,
      };
    },
  };
}
