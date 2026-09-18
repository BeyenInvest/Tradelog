// Parser van de rauwe page-world-snapshot naar een typed ChartState (F2a).
// Pure functie over `unknown` — DE vertrouwensgrens: elk veld wordt hier
// gevalideerd en degradeert naar { ok: false, reason } i.p.v. een stil
// verkeerde waarde (plan §2.3). Contract-getest tegen de S0-fixture.
import {
  plannedRR, positionPrices, tickSize, tickSizeFromFormatted, type PositionPrices,
} from "../../../src/lib/priceMath";
import { fail, ok, type Reading } from "./protocol";

export interface TickInfo {
  size: number;
  /** Waar de tick vandaan kwam — "formatter-props" is exact; "formatted-sample"
   * is de decimalen-fallback (faalt bewust op fracties zoals 0.25). */
  source: "formatter-props" | "formatted-sample";
}

export interface PositionState {
  id: string;
  direction: "Long" | "Short";
  entry: number;
  /** Bar-tijd van het entry-punt in UTC-seconden (replay-bewust). */
  entryTimeSec: number | null;
  stopLevelTicks: number;
  profitLevelTicks: number;
  /** Alleen gezet als de tick-size bekend is. */
  prices: (PositionPrices & { plannedRR: number | null }) | null;
}

/** Laatste bar van de hoofdserie (F5/S1): exit-prefill + replay-veilige sluitdatum. */
export interface LastBarInfo {
  /** Bar-tijd (start van de bar) in UTC-seconden — in replay de replay-tijd. */
  timeSec: number;
  close: number;
  /** true = TV's replay-modus staat aan (bar-tijd ≠ nu — precies waarom we 'm meenemen). */
  inReplay: boolean;
}

export interface ChartState {
  symbol: Reading<string>;
  resolution: Reading<string>;
  tick: Reading<TickInfo>;
  /** Alle position-tools op de chart; het paneel laat kiezen bij >1 (plan-risico 11). */
  positions: Reading<PositionState[]>;
  /** Laatste bar-close — degradeert los van de rest (het paneel valt dan terug op handmatige exit). */
  lastBar: Reading<LastBarInfo>;
}

function rec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Pakt een safe()-resultaat { ok, value, error } uit de page-world uit. */
function unwrapSafe(v: unknown): { value: unknown } | { error: string } {
  const r = rec(v);
  if (!r) return { error: "veld ontbreekt" };
  if (r.ok === true) return { value: r.value };
  return { error: typeof r.error === "string" ? r.error : "lezen faalde" };
}

function parseSymbol(raw: Record<string, unknown>): Reading<string> {
  const s = unwrapSafe(raw.symbol);
  if ("error" in s) return fail(`symbol: ${s.error}`);
  return typeof s.value === "string" && s.value ? ok(s.value) : fail("symbol: geen string");
}

function parseResolution(raw: Record<string, unknown>): Reading<string> {
  const r = unwrapSafe(raw.resolution);
  if ("error" in r) return fail(`resolution: ${r.error}`);
  return typeof r.value === "string" && r.value ? ok(r.value) : fail("resolution: geen string");
}

function parseTick(raw: Record<string, unknown>): Reading<TickInfo> {
  // Primair: de formatter-props (_minMove/_priceScale — S0-bewezen, maar
  // underscore-intern, dus defensief).
  const f = unwrapSafe(raw.formatter);
  if (!("error" in f)) {
    const props = rec(f.value);
    const minMove = num(props?.["_minMove"]);
    const priceScale = num(props?.["_priceScale"]);
    if (minMove != null && priceScale != null) {
      const size = tickSize(minMove, priceScale);
      if (size != null) return ok({ size, source: "formatter-props" });
    }
  }
  // Fallback: decimalen tellen in het format-voorbeeld.
  const sample = unwrapSafe(raw.formattedSample);
  if (!("error" in sample) && typeof sample.value === "string") {
    const size = tickSizeFromFormatted(sample.value);
    if (size != null) return ok({ size, source: "formatted-sample" });
  }
  return fail("tick-size onbepaalbaar (formatter-props én sample onbruikbaar)");
}

function parseOnePosition(entry: Record<string, unknown>, tick: number | null): PositionState | null {
  const name = entry.name;
  if (name !== "long_position" && name !== "short_position") return null;
  const direction = name === "long_position" ? "Long" : "Short";
  const id = typeof entry.id === "string" ? entry.id : String(entry.id ?? "");

  const points = unwrapSafe(entry.points);
  if ("error" in points || !Array.isArray(points.value) || points.value.length === 0) return null;
  const p0 = rec(points.value[0]);
  const entryPrice = num(p0?.price);
  if (entryPrice == null) return null;
  const entryTimeSec = num(p0?.time);

  const props = unwrapSafe(entry.properties);
  if ("error" in props) return null;
  const pr = rec(props.value);
  const stopLevelTicks = num(pr?.stopLevel);
  const profitLevelTicks = num(pr?.profitLevel);
  if (stopLevelTicks == null || profitLevelTicks == null) return null;

  let prices: PositionState["prices"] = null;
  if (tick != null) {
    const abs = positionPrices(direction, { entry: entryPrice, stopLevelTicks, profitLevelTicks }, tick);
    if (abs) prices = { ...abs, plannedRR: plannedRR(abs.entry, abs.stop, abs.target) };
  }

  return { id, direction, entry: entryPrice, entryTimeSec, stopLevelTicks, profitLevelTicks, prices };
}

function parsePositions(raw: Record<string, unknown>, tick: number | null): Reading<PositionState[]> {
  const shapes = unwrapSafe(raw.shapes);
  if ("error" in shapes) return fail(`shapes: ${shapes.error}`);
  if (!Array.isArray(shapes.value)) return fail("shapes: geen lijst");
  const out: PositionState[] = [];
  for (const s of shapes.value) {
    const r = rec(s);
    if (!r) continue;
    const pos = parseOnePosition(r, tick);
    if (pos) out.push(pos);
  }
  return ok(out);
}

/** tvMain's lastBar: { last: { index, value: [timeSec, o, h, l, c, ...] }, inReplay }. */
function parseLastBar(raw: Record<string, unknown>): Reading<LastBarInfo> {
  const lb = unwrapSafe(raw.lastBar);
  if ("error" in lb) return fail(`lastBar: ${lb.error}`);
  const outer = rec(lb.value);
  const bar = rec(outer?.last);
  const value = bar?.value;
  if (!Array.isArray(value) || value.length < 5) return fail("lastBar: geen bar-array");
  const timeSec = num(value[0]);
  const close = num(value[4]);
  if (timeSec == null || timeSec <= 0) return fail("lastBar: bar-tijd onbruikbaar");
  if (close == null || close <= 0) return fail("lastBar: close onbruikbaar");
  return ok({ timeSec, close, inReplay: outer?.inReplay === true });
}

/** Onbetrouwbare page-world-payload → typed ChartState met per-veld-degradatie. */
export function parseChartState(payload: unknown): ChartState {
  const allFail = (reason: string): ChartState => ({
    symbol: fail(reason), resolution: fail(reason), tick: fail(reason),
    positions: fail(reason), lastBar: fail(reason),
  });
  const raw = rec(payload);
  if (!raw) return allFail("geen antwoord uit de page-world");
  if (raw.bridgeTimeout === true) return allFail("page-world antwoordde niet (timeout)");
  if (raw.apiPresent !== true) return allFail("TradingViewApi niet gevonden — is dit een chart-pagina?");

  const tick = parseTick(raw);
  return {
    symbol: parseSymbol(raw),
    resolution: parseResolution(raw),
    tick,
    positions: parsePositions(raw, tick.ok ? tick.value.size : null),
    lastBar: parseLastBar(raw),
  };
}
