// De TV-koppeling van het snapshot-kader (chartFrame.ts): alleen page-world.
// Elke fout hier degradeert: een snapshot met een minder mooi kader is nog altijd
// een bruikbare snapshot.
import {
  applySnapshotFrame,
  isChartView,
  type ChartView,
  type FrameChart,
  type FrameResult,
  type SnapshotAnchor,
} from "../adapter/chartFrame";

interface TvTimeScale {
  barSpacing(): number;
  rightOffset(): number;
  width(): number;
  setBarSpacing(px: number): void;
  setRightOffset(bars: number): void;
}

interface TvBars {
  firstIndex(): number;
  lastIndex(): number;
  valueAt(index: number): unknown;
}

interface TvChart {
  executeActionById(id: string): void;
  getTimeScale(): TvTimeScale;
  getSeries(): { data(): { bars(): TvBars } };
  resolution(): string;
  setTimeFrame(frame: { val: { type: "time-range"; from: number; to: number }; res: string }): void;
}

function activeChart(): TvChart {
  const w = window as unknown as { TradingViewApi?: { activeChart?: () => TvChart } };
  const chart = w.TradingViewApi?.activeChart?.();
  if (!chart) throw new Error("activeChart() niet beschikbaar");
  return chart;
}

/** "Reset chart view" = TV's actie `chartReset` (Alt+R, GUIResetScales): standaard
 * spacing + right offset, prijs-as op auto. Runtime bewezen 2026-10-28: werkt
 * synchroon, en een timeframe-switch neemt de zoom van het vorige TF gewoon over. */
function frameChart(chart: TvChart, onReset: () => void): FrameChart {
  const scale = chart.getTimeScale();
  const bars = () => chart.getSeries().data().bars();
  return {
    resetView() {
      chart.executeActionById("chartReset");
      onReset();
    },
    width: () => scale.width(),
    rightOffset: () => scale.rightOffset(),
    setBarSpacing: (px) => scale.setBarSpacing(px),
    setRightOffset: (n) => scale.setRightOffset(n),
    firstIndex: () => bars().firstIndex(),
    lastIndex: () => bars().lastIndex(),
    timeAt(index) {
      const value = bars().valueAt(index);
      const time = Array.isArray(value) ? (value as unknown[])[0] : null;
      return typeof time === "number" ? time : null;
    },
    resolution: () => chart.resolution(),
    loadRange(fromSec, toSec) {
      chart.setTimeFrame({ val: { type: "time-range", from: fromSec, to: toSec }, res: chart.resolution() });
    },
  };
}

export async function frameSnapshot(
  anchor: SnapshotAnchor | null,
): Promise<{ viewReset: boolean; framing: FrameResult }> {
  let viewReset = false;
  try {
    const framing = await applySnapshotFrame(frameChart(activeChart(), () => { viewReset = true; }), anchor);
    return { viewReset, framing };
  } catch {
    return { viewReset, framing: "degraded" };
  }
}

export function readChartView(): ChartView | null {
  try {
    const scale = activeChart().getTimeScale();
    const view = { barSpacing: scale.barSpacing(), rightOffset: scale.rightOffset() };
    return isChartView(view) ? view : null;
  } catch {
    return null;
  }
}

export function applyChartView(view: ChartView): boolean {
  try {
    const scale = activeChart().getTimeScale();
    scale.setBarSpacing(view.barSpacing);
    scale.setRightOffset(view.rightOffset);
    return true;
  } catch {
    return false;
  }
}
