/**
 * Error monitoring, off by default. Sentry is only loaded (a dynamic import, so
 * it stays out of the main bundle) and only sends anything when VITE_SENTRY_DSN
 * is set — same "inert without a key" contract as CaptchaWidget. Errors only, no
 * performance tracing, and no default PII (IP/cookies) attached, so nothing
 * personal leaves the app unless deliberately added later.
 */
type SentryModule = typeof import("@sentry/react");

let sentry: SentryModule | null = null;

export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // no DSN → Sentry is never imported, nothing is ever sent

  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0, // errors only for now — no performance/tracing volume
    sendDefaultPii: false, // don't attach IP address / request cookies (GDPR)
  });
  sentry = Sentry;
}

/** Reports an error when monitoring is active; a safe no-op otherwise, so callers never need to guard. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return;
  sentry.captureException(error, context ? { extra: context } : undefined);
}
