// Snapshot-kader. "Reset chart view" alleen is te ruim voor een snapshot: bij
// TV's standaard-spacing staan er op een breed scherm 250+ bars in beeld, de
// automatische prijs-as schaalt daarop en de recente candles worden platgedrukt
// (GBPCAD W: as 1,46-1,92 tegen 1,60-1,91 met 8 px). De reset springt bovendien
// altijd naar de nieuwste bar, dus een oudere trade viel uit beeld.
//
// Daarom per slot: reset (prijs-as op auto) → vaste candlebreedte → en ligt de
// trade buiten dat beeld, dan het beeld naar de trade schuiven. Bewust een vaste
// breedte en geen vast aantal bars: dat laatste (v0.2.17) gaf op een breed scherm
// dikke candles (12+ px), wat de owner lomp vond. Nu oogt een candle op elk scherm
// hetzelfde en verschilt alleen hoeveel bars er passen.
// Alles hier is puur en testbaar; de TV-koppeling zit in tvFrame.ts.
//
// Runtime bewezen op de website (2026-11-05):
//  - `setVisibleRange` geeft "Not implemented"; `setTimeFrame` met een
//    time-range werkt wél en laadt zelf oudere data (TV laadt per timeframe maar
//    300 bars, op 2H nog geen 5 weken). `syncTime` schoot er ver naast.
//  - `setRightOffset` accepteert negatieve waarden (bars vóór de nieuwste bar).
//  - bar-indexen kunnen negatief zijn zodra oudere data binnenkomt, daarom altijd
//    tellen vanaf `lastIndex`.

import { normalizeResolution } from "./chartReady";

/** Candlebreedte in px (TV's standaard is 6). Gekozen op beeld, owner-besluit
 * 2026-11-05: 12 px oogt lomp, 6 px drukt de prijs-as plat. */
export const SNAPSHOT_BAR_SPACING = 8;
/** Hoeveel bars vóór de entry we bij het laden van historie opvragen. Gaat alleen
 * om de data: het beeld wordt daarna opnieuw gekaderd. */
const HISTORY_LOAD_BARS = 200;
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
  chart.loadRange(anchor.entrySec - barSec * HISTORY_LOAD_BARS, anchor.entrySec + barSec * (HISTORY_LOAD_BARS / 3));
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
    chart.setBarSpacing(SNAPSHOT_BAR_SPACING);
    return chart.rightOffset();
  };

  let defaultOffset = standard();
  if (!anchor) return "latest";

  try {
    if (await ensureHistory(chart, anchor, sleep)) defaultOffset = standard();
    const visibleBars = chart.width() / SNAPSHOT_BAR_SPACING;
    const lastIndex = chart.lastIndex();
    const firstIndex = chart.firstIndex();
    const indexOf = (sec: number) => barIndexAtOrBefore(sec, firstIndex, lastIndex, chart.timeAt);
    const entryIndex = indexOf(anchor.entrySec);
    if (!(visibleBars > 0) || entryIndex === null) {
      standard();
      return "degraded";
    }
    const endIndex = anchor.endSec === null ? null : indexOf(anchor.endSec);
    const offset = anchorRightOffset({
      barsAfterEntry: lastIndex - entryIndex,
      barsAfterEnd: endIndex === null ? null : lastIndex - endIndex,
      visibleBars,
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
