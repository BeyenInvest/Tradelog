/**
 * Full IANA timezone list from the runtime, with the reference default and the
 * currently-stored value guaranteed present (older browsers without
 * Intl.supportedValuesOf fall back to a short hand-picked list). Shared by the
 * settings timezone card and the first-run onboarding wizard so both offer the
 * same options. Pure — wrap in useMemo at the call site.
 */
export function timezoneOptions(current: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf?.("timeZone") ?? [
    "UTC",
    "Europe/Brussels",
    "Europe/London",
    "Africa/Johannesburg",
    "America/New_York",
  ];
  // The stored value (and the reference default) must always be selectable.
  const extras = ["Europe/Brussels", current].filter((z) => !zones.includes(z));
  return extras.length ? [...extras, ...zones] : zones;
}

/** Best-effort guess of the visitor's IANA timezone, for prefilling onboarding. */
export function guessTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
