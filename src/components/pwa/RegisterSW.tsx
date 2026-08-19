import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Registers the PWA service worker — but ONLY for beta accounts (Fase L soft-
 * launch). A service worker is origin-wide infrastructure, not a per-user React
 * gate like the rest of the beta features, so we contain its blast radius by
 * only registering it once a beta user is signed in. `virtual:pwa-register` is
 * dynamically imported so the registration code never ships to non-beta bundles.
 *
 * registerType 'autoUpdate' (vite.config) means a new build's worker activates
 * itself; `immediate: true` registers as soon as this mounts.
 */
export function RegisterSW() {
  const { betaFeatures } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!betaFeatures || registered.current) return;
    registered.current = true;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: true });
    });
  }, [betaFeatures]);

  return null;
}
