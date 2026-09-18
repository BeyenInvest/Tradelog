// Weergave-helpers van het paneel (F2d). Pure functies zonder DOM — het paneel
// rekent niets uit (dat doet priceMath/tradePayload), het formatteert alleen.

/** Waar elke "open in Beyen"-link heen wijst (log-succes én sluit-succes). */
export const JOURNAL_URL = "https://www.beyen.app/journal";

/**
 * TradingView-resolutie → hoe een trader het leest: "240" → "4H", "60" → "1H",
 * "15" → "15m", "D"/"W"/"M" blijven zoals ze zijn. Onbekende vormen geven we
 * onveranderd terug — liever de rauwe TV-waarde dan een gok.
 */
export function formatResolution(raw: string): string {
  const s = raw.trim();
  if (!s) return "—";

  const seconds = /^(\d+)S$/i.exec(s);
  if (seconds) return `${Number(seconds[1])}s`;

  if (!/^\d+$/.test(s)) return s.toUpperCase();

  const minutes = Number(s);
  if (!Number.isFinite(minutes) || minutes <= 0) return s;
  if (minutes < 60) return `${minutes}m`;
  if (minutes % 1440 === 0) return `${minutes / 1440}D`;
  if (minutes % 60 === 0) return `${minutes / 60}H`;
  return `${minutes}m`;
}

/**
 * Prijs zoals een chart 'm toont: puntdecimaal (trading-conventie, bewust géén
 * locale-groepering — een komma in een prijsveld is vragen om misleesbaarheid)
 * en zonder nul-staart.
 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(8).replace(/\.?0+$/, "");
  return fixed === "" || fixed === "-" ? String(value) : fixed;
}

/** R:R zoals de app 'm schrijft: "1 : 2.4"; null (geen TP) → "—". */
export function formatRR(rr: number | null | undefined): string {
  if (rr == null || !Number.isFinite(rr)) return "—";
  return `1 : ${Math.round(rr * 100) / 100}`;
}

/**
 * Bar-tijd van de position-tool (UTC-seconden) → leesbare lokale tijd. Puur
 * informatief: wat er opgeslagen wordt is de wall-clock in de profiel-tijdzone,
 * en dat rekent de server-kant (wallClockInTimezone) uit.
 */
export function formatBarTime(utcSec: number | null | undefined): string {
  if (utcSec == null || !Number.isFinite(utcSec)) return "—";
  try {
    return new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(utcSec * 1000));
  } catch {
    return "—";
  }
}

/** Wat een user in een getalveld typt → number|null (leeg blijft leeg, geen 0). */
export function parseNumberInput(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Idempotentie-sleutel voor één formulier-sessie; blijft gelijk bij een retry. */
export function newClientUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Fallback voor omgevingen zonder randomUUID (test/oudere builds): geen
  // cryptografische garantie nodig, alleen botsingsvrijheid per gebruiker.
  const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-a${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}
