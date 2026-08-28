import { useEffect, useRef } from "react";

/** How often an open tab re-checks for a newer service worker (P2). */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 min

/**
 * Registers the PWA service worker (Fase L). `virtual:pwa-register` is
 * dynamically imported so registration stays out of the initial bundle.
 *
 * registerType 'autoUpdate' (vite.config) means a new build's worker activates
 * itself; `immediate: true` registers as soon as this mounts.
 *
 * The PWA is on for everyone since the beta flip, so a long-lived tab could
 * otherwise sit on a stale build indefinitely — autoUpdate only swaps in a
 * worker it has already fetched, and nothing re-fetches without a reload. We
 * poll `registration.update()` on an interval so open tabs pick up new deploys
 * (P2).
 */
export function RegisterSW() {
  const registered = useRef(false);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({
        immediate: true,
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
    };
  }, []);

  return null;
}
