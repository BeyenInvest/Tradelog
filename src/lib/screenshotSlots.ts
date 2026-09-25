// Gedeelde catalogus voor de 4 screenshot-slots (0060 namen, 0061 timeframes).
// Eén bron van waarheid voor web (MethodologyEditor, TechnicalSection) én de
// TradingView-extensie (relatieve import, zelfde route als adapter/parse.ts →
// priceMath): welke TV-timeframes we aanbieden, wat de defaults per slot zijn
// en hoe een resolution als naam getoond wordt.
//
// De lijst is tegelijk de WHITELIST op de trust boundary: de extensie-SW
// valideert elke door het paneel aangeleverde resolution hiertegen voordat hij
// naar TV's setResolution gaat (plan-tv-extensie-engines.md §8.2).

/** Slot-index 0..3 = de vaste trade-kolommen w/d/h4/h2_screenshot. */
export const SLOT_COUNT = 4;

/** De standaard-TF per slot: het oude hardcoded W/D/4H/2H als TV-resolutions. */
export const DEFAULT_SLOT_TIMEFRAMES: readonly string[] = ["W", "D", "240", "120"];

/**
 * Aangeboden TV-resolutions — TV's standaardset die op elk abonnement bestaat.
 * Seconden-, range- en custom-intervals bewust niet (plan-gated bij TV, en de
 * settle-checks van de snapshot-cyclus zijn er niet op bewezen).
 */
export const SNAPSHOT_TIMEFRAMES = [
  "1", "3", "5", "15", "30", "45", // minuten
  "60", "120", "180", "240", // uren (TV telt intraday in minuten)
  "D", "W", "M",
] as const;
export type SnapshotTimeframe = (typeof SNAPSHOT_TIMEFRAMES)[number];

export function isSnapshotTimeframe(v: unknown): v is SnapshotTimeframe {
  return typeof v === "string" && (SNAPSHOT_TIMEFRAMES as readonly string[]).includes(v);
}

/** Resolution → naam zoals de trader 'm kent: "15" → "15m", "240" → "4H", "D" → "D". */
export function timeframeLabel(tf: string): string {
  const minutes = /^\d+$/.test(tf) ? Number(tf) : null;
  if (minutes === null) return tf; // D/W/M zijn al de gangbare namen
  if (minutes >= 60) return `${minutes / 60}H`;
  return `${minutes}m`;
}

/**
 * `methodologies.screenshot_timeframes` (rauw uit de DB) → de effectieve TF per
 * slot. Per positie: een geldige whitelist-waarde wint, al het andere (null,
 * lege string, onbekende resolution, verkeerd type) valt terug op de default
 * van dát slot — zelfde lees-tolerantie als de slot-namen (0060).
 */
export function resolveSlotTimeframes(custom: readonly unknown[] | null | undefined): string[] {
  return DEFAULT_SLOT_TIMEFRAMES.map((def, i) => {
    const v = custom?.[i];
    return typeof v === "string" && isSnapshotTimeframe(v.trim()) ? v.trim() : def;
  });
}

/**
 * De default-naam van een slot volgt de gekozen TF: wijkt de effectieve TF af
 * van de slot-standaard, dan is de TF-naam ("15m") een betere default dan het
 * oude "Weekly"/"Screenshot 1". null = geen afwijking, gebruik de vaste default.
 */
export function customTimeframeLabel(custom: readonly unknown[] | null | undefined, slotIndex: number): string | null {
  const effective = resolveSlotTimeframes(custom)[slotIndex];
  return effective === DEFAULT_SLOT_TIMEFRAMES[slotIndex] ? null : timeframeLabel(effective);
}

/**
 * De getoonde naam van een slot: de eigen journal-naam (0060) als die gezet is,
 * anders de naam van een afwijkende TF (0061), anders de meegegeven vaste default
 * (vertaald door de caller — dit bestand blijft i18n-vrij voor de extensie).
 */
export function screenshotSlotLabel(
  labels: readonly (string | null | undefined)[] | null | undefined,
  timeframes: readonly unknown[] | null | undefined,
  defaults: readonly string[],
  slotIndex: number
): string {
  return labels?.[slotIndex]?.trim() || customTimeframeLabel(timeframes, slotIndex) || defaults[slotIndex];
}
