// Snapshot-kader (v0.2.17). "Reset chart view" alleen is te ruim voor een
// snapshot: op een breed scherm staan er bij TV's standaard-spacing 250+ bars in
// beeld, de automatische prijs-as schaalt daarop en de recente candles worden
// platgedrukt (runtime gemeten op GBPCAD W: as 1,46-1,92 tegen 1,75-1,91 met 120
// bars). De reset springt bovendien altijd naar de nieuwste bar, dus een oudere
// trade viel uit beeld.
//
// Daarom per slot: reset (prijs-as op auto) → vast aantal bars, ongeacht de
// schermbreedte → en ligt de trade buiten dat beeld, dan het beeld naar de trade
// schuiven. Alles hier is puur en testbaar; de TV-koppeling zit in tvFrame.ts.
//
// Runtime bewezen op de website (2026-11-05):
//  - `setVisibleRange` geeft "Not implemented"; `setTimeFrame` met een
//    time-range werkt wél en laadt zelf oudere data (TV laadt per timeframe maar
//    300 bars, op 2H nog geen 5 weken). `syncTime` schoot er ver naast.
//  - `setRightOffset` accepteert negatieve waarden (bars vóór de nieuwste bar).
//  - bar-indexen kunnen negatief zijn zodra oudere data binnenkomt, daarom altijd
//    tellen vanaf `lastIndex`.

import { normalizeResolution } from "./chartReady";

export const SNAPSHOT_BARS = 120;
/** TV's eigen standaard (chartReset): nooit verder uitzoomen dan dat, ook niet
 * op een smal chart-venster. */
export const MIN_BAR_SPACING = 6;
/** Maximale wachttijd op oudere data na `setTimeFrame`. */
export const HISTORY_LOAD_TIMEOUT_MS = 2500;
const HISTORY_POLL_MS = 50;

/** Blijft er links van de entry minder dan dit deel van het beeld over, dan
 * schuiven we: anders staat de entry tegen de rand, zonder aanloop. */
const MIN_CONTEXT_SHARE = 0.15;
/** Ruimte rechts van de entry bij het schuiven: twee derde aanloop, een derde
 * voor wat er daarna gebeurde. */
const ENTRY_RIGHT_SHARE = 1 / 3;
/** Een lange trade krijgt meer ruimte rechts, tot dit deel van het beeld; de
 * entry blijft dus altijd zichtbaar. */
const MAX_RIGHT_SHARE = 0.8;
const TRADE_END_MARGIN_BARS = 5;

/** De trade waarop een snapshot gericht wordt (position-tool, epoch-seconden). */
export interface SnapshotAnchor {
  entrySec: number;
  endSec: number | null;
}

/** De zoom van de trader, om na de cyclus terug te zetten. */
export interface ChartView {
  barSpacing: number;
  rightOffset: number;
}

const isEpoch = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Vertrouwensgrens: deze waarden komen uit berichten en gaan naar TV. */
export function isSnapshotAnchor(v: unknown): v is SnapshotAnchor {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return isEpoch(a.entrySec) && (a.endSec === null || isEpoch(a.endSec));
}

export function isChartView(v: unknown): v is ChartView {
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return isEpoch(a.barSpacing) && typeof a.rightOffset === "number" && Number.isFinite(a.rightOffset);
}

/** Duur van één bar; null = onbekend timeframe. */
export function resolutionSeconds(resolution: string): number | null {
  const r = normalizeResolution(resolution);
  if (r === "D") return 86_400;
  if (r === "W") return 604_800;
  if (r === "M") return 2_592_000;
  return /^\d+$/.test(r) && Number(r) > 0 ? Number(r) * 60 : null;
}

/** Spacing voor SNAPSHOT_BARS bars naast de lege ruimte rechts. null = de
 * breedte is onbruikbaar (verborgen chart, TV-drift). */
export function snapshotBarSpacing(width: number, rightOffset: number): number | null {
  if (!Number.isFinite(width) || width <= 0) return null;
  return Math.max(MIN_BAR_SPACING, width / (SNAPSHOT_BARS + Math.max(0, rightOffset)));
}

/** Laatste bar die op of vóór `timeSec` start. Een entry op 2H valt zo in de
 * juiste week-bar. null = ouder dan alle geladen data, of onleesbare bars. */
export function barIndexAtOrBefore(
  timeSec: number,
  firstIndex: number,
  lastIndex: number,
  timeAt: (index: number) => number | null,
): number | null {
  const first = timeAt(firstIndex);
  if (first === null || first > timeSec) return null;
  let low = firstIndex;
  let high = lastIndex;
  while (low < high) {
    const mid = low + Math.ceil((high - low) / 2);
    const t = timeAt(mid);
    if (t === null) return null;
    if (t <= timeSec) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Right offset die de trade in beeld zet; null = het beeld bij de nieuwste bar
 * toont de trade al, met genoeg aanloop. */
export function anchorRightOffset(input: {
  barsAfterEntry: number;
  barsAfterEnd: number | null;
  visibleBars: number;
  defaultOffset: number;
}): number | null {
  const { barsAfterEntry, barsAfterEnd, visibleBars, defaultOffset } = input;
  if (barsAfterEntry + defaultOffset <= visibleBars * (1 - MIN_CONTEXT_SHARE)) return null;
  const tradeBars = barsAfterEnd === null ? 0 : Math.max(0, barsAfterEntry - barsAfterEnd);
  const rightOfEntry = Math.min(
    visibleBars * MAX_RIGHT_SHARE,
    Math.max(visibleBars * ENTRY_RIGHT_SHARE, tradeBars + TRADE_END_MARGIN_BARS),
  );
  return Math.min(defaultOffset, Math.round(rightOfEntry - barsAfterEntry));
}

/** Wat het kader van de chart nodig heeft; tvFrame.ts levert de echte TV-versie. */
export interface FrameChart {
  resetView(): void;
  width(): number;
  rightOffset(): number;
  setBarSpacing(px: number): void;
  setRightOffset(bars: number): void;
  firstIndex(): number;
  lastIndex(): number;
  timeAt(index: number): number | null;
  resolution(): string;
  /** Beeld + data naar deze periode (`setTimeFrame`). Verplaatst de chart. */
  loadRange(fromSec: number, toSec: number): void;
}

/** latest = nieuwste bars rechts; anchored = naar de trade geschoven; degraded =
 * de trade kon niet in beeld, dus de standaard-uitsnede. */
export type FrameResult = "latest" | "anchored" | "degraded";

/** Laadt oudere data als de entry vóór de geladen bars ligt. true = de chart is
 * daarbij verplaatst. */
async function ensureHistory(
  chart: FrameChart,
  anchor: SnapshotAnchor,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  const notLoaded = () => (chart.timeAt(chart.firstIndex()) ?? Infinity) > anchor.entrySec;
  if (!notLoaded()) return false;
  const barSec = resolutionSeconds(chart.resolution());
  if (barSec === null) return false;
  chart.loadRange(anchor.entrySec - barSec * SNAPSHOT_BARS, anchor.entrySec + barSec * (SNAPSHOT_BARS / 3));
  for (let waited = 0; waited < HISTORY_LOAD_TIMEOUT_MS && notLoaded(); waited += HISTORY_POLL_MS) {
    await sleep(HISTORY_POLL_MS);
  }
  return true;
}

/** Zet de chart in het snapshot-kader. De fallback is altijd de standaard-
 * uitsnede bij de nieuwste bar: een snapshot gaat nooit verloren aan het kader. */
export async function applySnapshotFrame(
  chart: FrameChart,
  anchor: SnapshotAnchor | null,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<FrameResult> {
  const standard = () => {
    chart.resetView();
    const defaultOffset = chart.rightOffset();
    const spacing = snapshotBarSpacing(chart.width(), defaultOffset);
    if (spacing !== null) chart.setBarSpacing(spacing);
    return { defaultOffset, spacing };
  };

  let frame = standard();
  if (!anchor) return "latest";

  try {
    if (await ensureHistory(chart, anchor, sleep)) frame = standard();
    const { defaultOffset, spacing } = frame;
    const lastIndex = chart.lastIndex();
    const firstIndex = chart.firstIndex();
    const indexOf = (sec: number) => barIndexAtOrBefore(sec, firstIndex, lastIndex, chart.timeAt);
    const entryIndex = indexOf(anchor.entrySec);
    if (spacing === null || entryIndex === null) {
      standard();
      return "degraded";
    }
    const endIndex = anchor.endSec === null ? null : indexOf(anchor.endSec);
    const offset = anchorRightOffset({
      barsAfterEntry: lastIndex - entryIndex,
      barsAfterEnd: endIndex === null ? null : lastIndex - endIndex,
      visibleBars: chart.width() / spacing,
      defaultOffset,
    });
    if (offset === null) return "latest";
    chart.setRightOffset(offset);
    return "anchored";
  } catch {
    standard();
    return "degraded";
  }
}
