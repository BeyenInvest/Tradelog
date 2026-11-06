// Snapshot-kader. "Reset chart view" alleen is te ruim voor een snapshot: op een
// breed scherm staan er 250+ bars in beeld, de automatische prijs-as schaalt daarop
// en de recente candles worden platgedrukt (GBPCAD W: as 1,46-1,92). De reset
// springt bovendien altijd naar de nieuwste bar, dus een oudere trade viel uit beeld.
//
// Daarom per slot: reset (TV's eigen candlebreedte, prijs-as op auto) → de entry van
// de laatste trade op twee derde van het beeld. Bij een recente trade blijft rechts
// lege ruimte over; oude geschiedenis schuift zo links uit beeld en de automatische
// prijs-as zoomt vanzelf in (GBPCAD W: 1,64-1,91), zonder afgekapte candles.
//
// Bewust verworpen na owner-feedback op echte snapshots (2026-11):
//  - vast aantal bars (v0.2.17): dikke candles, afhankelijk van de schermbreedte;
//  - vaste candlebreedte van 8 px (v0.2.18): nog steeds te dik;
//  - prijs-as passend op het recente deel: kapt candles af en botst met de legenda.
// Alles hier is puur en testbaar; de TV-koppeling zit in tvFrame.ts.
//
// Runtime bewezen op de website (2026-11-05/06):
//  - `setVisibleRange` geeft "Not implemented"; `setTimeFrame` met een
//    time-range werkt wél en laadt zelf oudere data (TV laadt per timeframe maar
//    300 bars, op 2H nog geen 5 weken). `syncTime` schoot er ver naast.
//  - `setRightOffset` accepteert negatieve waarden (bars vóór de nieuwste bar).
//  - TV vult ontbrekende bars links niet meteen aan na een `setRightOffset`: zonder
//    eigen load staat daar een leeg vlak op de snapshot.
//  - bar-indexen kunnen negatief zijn zodra oudere data binnenkomt, daarom altijd
//    tellen vanaf `lastIndex`.

import { normalizeResolution } from "./chartReady";

/** Maximale wachttijd op oudere data na `setTimeFrame`. */
export const HISTORY_LOAD_TIMEOUT_MS = 2500;
/** Staat de entry al in de data en komt er niets meer bij, dan niet de volle
 * wachttijd uitzitten: jonge symbolen hebben simpelweg niet meer historie. */
export const HISTORY_STALL_MS = 800;
const HISTORY_POLL_MS = 50;
/** Hoeveel beeldbreedtes historie vóór de entry we willen hebben. Ruimer dan 1,
 * want op intraday tellen weekends en sluitingsuren wel als tijd maar niet als bar. */
const HISTORY_CONTEXT_FACTOR = 1.5;
/** We vragen iets meer op dan we controleren: TV levert tot net ná de gevraagde
 * datum, en anders blijft de check nét falen en kost elk slot de wachttijd. */
const HISTORY_REQUEST_MARGIN = 0.25;

/** Ruimte rechts van de entry: twee derde aanloop, een derde voor wat erna kwam. */
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

/** Right offset die de entry op twee derde zet. Positief = lege ruimte rechts van
 * de nieuwste bar, negatief = het beeld stopt vóór de nieuwste bar. */
export function anchorRightOffset(input: {
  barsAfterEntry: number;
  barsAfterEnd: number | null;
  visibleBars: number;
}): number {
  const { barsAfterEntry, barsAfterEnd, visibleBars } = input;
  const tradeBars = barsAfterEnd === null ? 0 : Math.max(0, barsAfterEntry - barsAfterEnd);
  const rightOfEntry = Math.min(
    visibleBars * MAX_RIGHT_SHARE,
    Math.max(visibleBars * ENTRY_RIGHT_SHARE, tradeBars + TRADE_END_MARGIN_BARS),
  );
  return Math.round(rightOfEntry - barsAfterEntry);
}

/** Wat het kader van de chart nodig heeft; tvFrame.ts levert de echte TV-versie. */
export interface FrameChart {
  resetView(): void;
  width(): number;
  barSpacing(): number;
  setRightOffset(bars: number): void;
  firstIndex(): number;
  lastIndex(): number;
  timeAt(index: number): number | null;
  resolution(): string;
  /** Beeld + data naar deze periode (`setTimeFrame`). Verplaatst de chart. */
  loadRange(fromSec: number, toSec: number): void;
}

/** latest = geen trade, de nieuwste bar op twee derde; anchored = de trade op twee
 * derde; degraded = de trade kon niet in beeld, dus de nieuwste bars of alleen de
 * reset. */
export type FrameResult = "latest" | "anchored" | "degraded";

/** Zorgt voor aanloop links van `targetSec`, anders staat daar een leeg vlak op de
 * snapshot. true = de chart is daarbij verplaatst. */
async function ensureHistory(
  chart: FrameChart,
  targetSec: number,
  visibleBars: number,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  const barSec = resolutionSeconds(chart.resolution());
  if (barSec === null || !(visibleBars > 0)) return false;
  const neededFrom = targetSec - barSec * visibleBars * HISTORY_CONTEXT_FACTOR;
  const firstTime = () => chart.timeAt(chart.firstIndex()) ?? Infinity;
  if (firstTime() <= neededFrom) return false;

  chart.loadRange(
    neededFrom - barSec * visibleBars * HISTORY_REQUEST_MARGIN,
    targetSec + barSec * visibleBars * ENTRY_RIGHT_SHARE,
  );
  let seen = firstTime();
  let stalled = 0;
  for (let waited = 0; waited < HISTORY_LOAD_TIMEOUT_MS && seen > neededFrom; waited += HISTORY_POLL_MS) {
    if (stalled >= HISTORY_STALL_MS && seen <= targetSec) break;
    await sleep(HISTORY_POLL_MS);
    const now = firstTime();
    stalled = now === seen ? stalled + HISTORY_POLL_MS : 0;
    seen = now;
  }
  return true;
}

/** Zet de chart in het snapshot-kader. De fallback blijft TV's eigen reset: een
 * snapshot gaat nooit verloren aan het kader. */
export async function applySnapshotFrame(
  chart: FrameChart,
  anchor: SnapshotAnchor | null,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<FrameResult> {
  chart.resetView();
  const visibleBars = () => chart.width() / chart.barSpacing();

  try {
    const targetSec = anchor?.entrySec ?? chart.timeAt(chart.lastIndex());
    if (targetSec === null) return "degraded";
    if (await ensureHistory(chart, targetSec, visibleBars(), sleep)) chart.resetView();

    const visible = visibleBars();
    if (!Number.isFinite(visible) || visible <= 0) return "degraded";
    const lastIndex = chart.lastIndex();
    const firstIndex = chart.firstIndex();
    const indexOf = (sec: number) => barIndexAtOrBefore(sec, firstIndex, lastIndex, chart.timeAt);

    const entryIndex = anchor ? indexOf(anchor.entrySec) : lastIndex;
    if (entryIndex === null) {
      chart.resetView();
      chart.setRightOffset(anchorRightOffset({ barsAfterEntry: 0, barsAfterEnd: null, visibleBars: visible }));
      return "degraded";
    }
    const endIndex = anchor?.endSec ? indexOf(anchor.endSec) : null;
    chart.setRightOffset(anchorRightOffset({
      barsAfterEntry: lastIndex - entryIndex,
      barsAfterEnd: endIndex === null ? null : lastIndex - endIndex,
      visibleBars: visible,
    }));
    return anchor ? "anchored" : "latest";
  } catch {
    chart.resetView();
    return "degraded";
  }
}
