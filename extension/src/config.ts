// Publieke configuratie van de extensie. De publishable (anon) key is per
// definitie publiek — alle rechten komen van de user-JWT + RLS, nooit van deze key.
export const SUPABASE_URL = "https://isjsivkrzqpqutoonuzf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_OwDndcPWRrxDQV1uoyT7Xg_tR0z9OqF";

/** chrome.alarms-interval voor sessie-refresh. Access-tokens leven ~60 min;
 * 50 min houdt de sessie warm zonder onnodige rotatie (S0-spike bewees het
 * mechanisme op 1 min over 15 SW-restarts heen). */
export const REFRESH_ALARM_NAME = "beyen-session-refresh";
export const REFRESH_ALARM_MINUTES = 50;

/** Ringbuffer-lengte van het diagnose-log in chrome.storage.local. */
export const LOG_MAX_ENTRIES = 100;
