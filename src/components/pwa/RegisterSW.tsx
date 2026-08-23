import { useEffect, useRef } from "react";

/**
 * Registers the PWA service worker (Fase L). `virtual:pwa-register` is
 * dynamically imported so registration stays out of the initial bundle.
 *
 * registerType 'autoUpdate' (vite.config) means a new build's worker activates
 * itself; `immediate: true` registers as soon as this mounts.
 */
export function RegisterSW() {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: true });
    });
  }, []);

  return null;
}
