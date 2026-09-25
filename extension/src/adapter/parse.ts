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
  /** Waar de tick vandaan kwam — "formatter-props" is exact; "symbol-ext"
   * (minmov/pricescale uit symbolExt(), publieke velden) is even exact maar
   * tweede keus omdat de formatter fracties als 1/32 al verrekend heeft;
   * "formatted-sample" is de decimalen-fallback (faalt bewust op fracties
   * zoals 0.25). */
  source: "formatter-props" | "symbol-ext" | "formatted-sample";
}

/** Een position-tool die op de chart staat maar niet geparseerd kon worden —
 * telemetrie voor TV-drift (D4): het paneel meldt 'm en de SW logt 'm, zodat
 * een vormverandering zichtbaar wordt vóór gebruikersklachten. */
export interface DroppedShape {
  id: string;
  reason: string;
}

export interface PositionState {
  id: string;
  direction: "Long" | "Short";
  entry: number;
  /** Bar-tijd van het entry-punt in UTC-seconden (replay-bewust). */
  entryTimeSec: number | null;
  /** Bar-tijd van de rechterrand van de tool (punt 2) — waar de trade "stopt".
   * Alleen gezet als hij ná de entry ligt; basis voor de sluitdatum-prefill. */
  endTimeSec: number | null;
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
  /** Position-tools die er wél staan maar niet leesbaar waren (D4-telemetrie). */
  dropped: DroppedShape[];
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
  // Tweede bron (D5): symbolExt() draagt dezelfde minmov/pricescale als
  // publieke, gedocumenteerde velden — overleeft TV-drift op de underscore-
  // interne formatter-props. Vóór de sample-teller, want dit blijft exact
  // (fracties als 0.25 komen hier wél goed door).
  const ext = unwrapSafe(raw.symbolExt);
  if (!("error" in ext)) {
    const e = rec(ext.value);
    const minMove = num(e?.minmov) ?? num(e?.minmove);
    const priceScale = num(e?.pricescale);
    if (minMove != null && priceScale != null) {
      const size = tickSize(minMove, priceScale);
      if (size != null) return ok({ size, source: "symbol-ext" });
    }
  }
  // Fallback: decimalen tellen in het format-voorbeeld.
  const sample = unwrapSafe(raw.formattedSample);
  if (!("error" in sample) && typeof sample.value === "string") {
    const size = tickSizeFromFormatted(sample.value);
    if (size != null) return ok({ size, source: "formatted-sample" });
  }
  return fail("tick-size onbepaalbaar (formatter-props, symbolExt én sample onbruikbaar)");
}

/** Eén position-tool parsen; { drop } zegt wáárom hij onleesbaar was (D4) —
 * een vorm-drift bij TV hoort een reden te krijgen, geen stille skip. */
function parseOnePosition(
  entry: Record<string, unknown>,
  tick: number | null
): { pos: PositionState } | { drop: string } {
  const name = entry.name === "long_position" ? "long_position" : "short_position";
  const direction = name === "long_position" ? "Long" : "Short";
  const id = typeof entry.id === "string" ? entry.id : String(entry.id ?? "");

  // tvMain kon de shape zelf al niet uitlezen (getShapeById faalde).
  if (typeof entry.shapeError === "string") return { drop: entry.shapeError };

  const points = unwrapSafe(entry.points);
  if ("error" in points) return { drop: `points: ${points.error}` };
  if (!Array.isArray(points.value) || points.value.length === 0) return { drop: "points: geen lijst" };
  const p0 = rec(points.value[0]);
  const entryPrice = num(p0?.price);
  if (entryPrice == null) return { drop: "points[0].price onleesbaar" };
  const entryTimeSec = num(p0?.time);
  // Punt 2 = de rechterrand van de position-box. De sluitdatum hoort dáár
  // vandaan te komen, niet van de laatste zichtbare bar van de chart (die staat
  // buiten replay willekeurig ver voorbij het einde van de trade).
  const rawEnd = num(rec(points.value[1])?.time);
  const endTimeSec = rawEnd != null && (entryTimeSec == null || rawEnd > entryTimeSec) ? rawEnd : null;

  const props = unwrapSafe(entry.properties);
  if ("error" in props) return { drop: `properties: ${props.error}` };
  const pr = rec(props.value);
  const stopLevelTicks = num(pr?.stopLevel);
  const profitLevelTicks = num(pr?.profitLevel);
  if (stopLevelTicks == null || profitLevelTicks == null) {
    return { drop: "stopLevel/profitLevel onleesbaar" };
  }

  let prices: PositionState["prices"] = null;
  if (tick != null) {
    const abs = positionPrices(direction, { entry: entryPrice, stopLevelTicks, profitLevelTicks }, tick);
    if (abs) prices = { ...abs, plannedRR: plannedRR(abs.entry, abs.stop, abs.target) };
  }

  return { pos: { id, direction, entry: entryPrice, entryTimeSec, endTimeSec, stopLevelTicks, profitLevelTicks, prices } };
}

function parsePositions(
  raw: Record<string, unknown>,
  tick: number | null
): { reading: Reading<PositionState[]>; dropped: DroppedShape[] } {
  const shapes = unwrapSafe(raw.shapes);
  if ("error" in shapes) return { reading: fail(`shapes: ${shapes.error}`), dropped: [] };
  if (!Array.isArray(shapes.value)) return { reading: fail("shapes: geen lijst"), dropped: [] };
  const out: PositionState[] = [];
  const dropped: DroppedShape[] = [];
  for (const s of shapes.value) {
    const r = rec(s);
    // Alleen de position-tools tellen — andere shapes zijn bewust genegeerde ruis.
    if (!r || (r.name !== "long_position" && r.name !== "short_position")) continue;
    const result = parseOnePosition(r, tick);
    if ("pos" in result) out.push(result.pos);
    else dropped.push({ id: typeof r.id === "string" ? r.id : String(r.id ?? "?"), reason: result.drop });
  }
  return { reading: ok(out), dropped };
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
    positions: fail(reason), dropped: [], lastBar: fail(reason),
  });
  const raw = rec(payload);
  if (!raw) return allFail("geen antwoord uit de page-world");
  if (raw.bridgeTimeout === true) return allFail("page-world antwoordde niet (timeout)");
  if (raw.apiPresent !== true) return allFail("TradingViewApi niet gevonden — is dit een chart-pagina?");

  const tick = parseTick(raw);
  const positions = parsePositions(raw, tick.ok ? tick.value.size : null);
  return {
    symbol: parseSymbol(raw),
    resolution: parseResolution(raw),
    tick,
    positions: positions.reading,
    dropped: positions.dropped,
    lastBar: parseLastBar(raw),
  };
}
