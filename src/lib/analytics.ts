// Plausible custom events (launchplan L6). `window.plausible` komt uit
// public/plausible-init.js (wachtrij-stub) + het async Plausible-script; ontbreekt
// het (adblocker, tests), dan is dit een stille no-op. De event-namen moeten als
// "Goal" in het Plausible-dashboard bestaan om als conversie te tellen.
type PlausibleFn = (event: string, options?: { props?: Record<string, string> }) => void;

export type AnalyticsEvent = "Signup";

export function trackEvent(event: AnalyticsEvent): void {
  try {
    (window as unknown as { plausible?: PlausibleFn }).plausible?.(event);
  } catch {
    // Analytics mag de app nooit breken.
  }
}
