import { useEffect, useRef } from "react";
import { hasDirtyForm, whenAllFormsClean } from "@/lib/dirtyFormRegistry";

/** How often an open tab re-checks for a newer service worker (P2). */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min

/**
 * Registers the PWA service worker (Fase L). `virtual:pwa-register` is
 * dynamically imported so registration stays out of the initial bundle.
 *
 * registerType "prompt" (vite.config, fixplan F1): a new build's worker waits
 * until we call updateSW(true), which activates it and reloads the page. We
 * call that immediately when no form has unsaved changes — the same silent
 * always-fresh behaviour autoUpdate gave — but while a dirty trade/review form
 * is open the reload is parked until the last dirty form closes or saves
 * (dirtyFormRegistry), so a 21:30 deploy can never wipe a half-written review.
 *
 * The PWA is on for everyone since the beta flip, so a long-lived tab could
 * otherwise sit on a stale build indefinitely — we poll `registration.update()`
 * on an interval so open tabs pick up new deploys (P2).
 */
export function RegisterSW() {
  const registered = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);
  const cancelPendingRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          const apply = () => void updateSW(true);
          if (!hasDirtyForm()) {
            apply();
          } else {
            // Park the reload until every dirty form is closed/saved. One shot:
            // a second onNeedRefresh (rare — an even newer deploy) replaces it.
            cancelPendingRef.current?.();
            cancelPendingRef.current = whenAllFormsClean(apply);
          }
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          intervalRef.current = window.setInterval(() => {
            // Skip while offline — an update() would just fail; the next tick retries.
            if (navigator.onLine !== false) void registration.update();
          }, UPDATE_CHECK_INTERVAL_MS);
        },
      });
    });
    return () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      cancelPendingRef.current?.();
    };
  }, []);

  return null;
}
