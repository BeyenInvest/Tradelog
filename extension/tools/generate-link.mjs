// S0-spike — genereert een magiclink token_hash via de Supabase admin-API.
// Dit simuleert wat het latere api/extension-link-endpoint (F1a) server-side doet.
// Gebruik:  $env:SUPABASE_SERVICE_ROLE_KEY = "<key>"; node tools/generate-link.mjs jouw@email
// De service-role-key komt uit het Supabase-dashboard (Settings -> API) en blijft
// ALTIJD lokaal — nooit in de extensie, nooit in git.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://isjsivkrzqpqutoonuzf.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!key || !email) {
  console.error("Gebruik: SUPABASE_SERVICE_ROLE_KEY zetten + `node tools/generate-link.mjs <e-mail>`");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) {
  console.error("Fout:", error.message);
  process.exit(1);
}
console.log("token_hash:", data.properties.hashed_token);
console.log("Kortlevend + eenmalig — plak 'm direct in de spike-popup (veld 3a).");
