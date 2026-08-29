import { Document, Page, Text, View, StyleSheet, Svg, Polyline, Polygon, Line, Rect, Circle, Path } from "@react-pdf/renderer";
import type { ReviewPdfData, ReviewPdfSection, ReviewPdfTradeGroup, ReviewPdfActie } from "./reviewPdfData";
import { formatAggregate } from "@/lib/format";
import type { ResultUnit } from "@/lib/constants";

/*
  Branded, self-contained review PDF. Uses only the built-in PDF fonts
  (Helvetica + Times-Italic) so generation never depends on a font CDN being
  reachable — a share/export action must not fail because a network fetch did.
  The brand comes through the ink header band, the gold accents, the wordmark
  and the layout rather than the exact Instrument Serif face used on-screen.

  Palette mirrors the app's *light* theme (src/index.css :root.light) since the
  document is printed on white paper.
*/

const C = {
  ink: "#1E2024",
  inkBand: "#191B1F",
  muted: "#6B6E76",
  faint: "#A3A6AE",
  gold: "#A6791C",
  goldOnDark: "#D4A64A",
  win: "#2F8558",
  loss: "#C7473A",
  be: "#B0703A",
  paper: "#FFFFFF",
  surface2: "#F3EFE6",
  border: "#DDD6C7",
  borderSoft: "#E6E1D6",
  onDark: "#F1EFEA",
};

const SANS = "Helvetica";
const SANS_BOLD = "Helvetica-Bold";
// The app's display serif, embedded via registerPdfFonts (call ensurePdfFonts()
// before rendering). Used ONLY in the masthead (heading + trader name) as the
// brand accent — the whole body deliberately stays in one sans face so the
// sections read as a single, uniform system rather than a mix of typefaces.
const DISPLAY = "InstrumentSerif";

// One type scale for the whole document — seven fixed steps, no fractional or
// one-off sizes. Every fontSize in this file must come from here so the PDF
// reads as a single, coherent system rather than a dozen slightly-different sizes.
//   hero  → main heading + wordmark
//   title → big numbers / pull-quote / trader name
//   lead  → donut centre %
//   body  → all running text
//   small → table cells, legend, footer brand
//   micro → every uppercase eyebrow label + footer meta
//   chart → SVG axis labels
const T = {
  hero: 22,
  title: 16,
  lead: 13,
  body: 9,
  small: 8,
  micro: 7,
  chart: 6,
} as const;

const styles = StyleSheet.create({
  // paddingTop gives every *continuation* page a clean top margin; the header band
  // cancels it with a negative marginTop so it still bleeds to the very top of page 1.
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: SANS, fontSize: T.body, paddingTop: 34, paddingBottom: 48 },

  band: {
    marginTop: -34,
    backgroundColor: C.inkBand,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 40,
    flexDirection: "column",
  },
  bandTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  bandRule: { height: 3, backgroundColor: C.gold },
  wordmark: { fontFamily: SANS_BOLD, fontSize: T.hero, color: C.onDark, letterSpacing: 0.5 },
  eye: { color: C.goldOnDark },
  tagline: { fontFamily: SANS, fontSize: T.micro, color: C.goldOnDark, letterSpacing: 2.2, marginTop: 6 },
  headingWrap: { alignItems: "flex-end", maxWidth: 300 },
  heading: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: T.hero, color: C.goldOnDark },
  subtitle: { fontFamily: SANS, fontSize: T.body, color: C.faint, marginTop: 3, maxWidth: 260, textAlign: "right" },
  generatedOn: { fontFamily: SANS, fontSize: T.micro, color: C.faint, marginTop: 5 },

  // Centered "prepared for <trader>" strip inside the ink masthead — makes the
  // export feel addressed to the trader instead of hiding the name in the corner.
  personalBand: { alignItems: "center", marginTop: 16 },
  personalEyebrow: { fontFamily: SANS_BOLD, fontSize: T.micro, color: C.goldOnDark, letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 4, textAlign: "center" },
  personalName: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: T.hero, color: C.onDark, textAlign: "center" },

  body: { paddingHorizontal: 40, paddingTop: 22 },

  sectionLabel: {
    fontFamily: SANS_BOLD,
    fontSize: T.micro,
    color: C.gold,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  kpiCard: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kpiLabel: { fontSize: T.micro, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  kpiValue: { fontFamily: SANS_BOLD, fontSize: T.title },

  chartsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  // Charts share the exact surface of the KPI tiles so the whole top block reads
  // as one "dashboard" tier — no competing box treatments (borders vs fills).
  chartBox: { backgroundColor: C.surface2, borderRadius: 6, padding: 12 },
  chartLabel: { fontSize: T.micro, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },

  donutWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  donutPct: { fontFamily: SANS_BOLD, fontSize: T.lead, color: C.ink, lineHeight: 1, textAlign: "center" },
  donutCaption: { fontSize: T.micro, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2, textAlign: "center" },
  chartBody: { flexGrow: 1, justifyContent: "center" },
  wlLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 10 },
  wlLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  wlDot: { width: 7, height: 7, borderRadius: 2 },
  wlLegendText: { fontSize: T.small, color: C.ink },

  errorLine: { fontSize: T.small, color: C.muted, marginBottom: 18 },

  // Every written section — narrative, technical, mental, overall — shares ONE
  // treatment: a gold eyebrow label + plain body at a single size. The reflective
  // blocks are no longer boxed in assorted tints; the page reads as one calm
  // editorial column instead of a stack of mismatched cards.
  section: { marginBottom: 15 },
  sectionBody: { fontSize: T.body, lineHeight: 1.6, color: C.ink },

  // The takeaway keeps a slim gold rule as its only accent, but the text itself is
  // the same upright sans body as every other section — no serif, no italic, no
  // larger size — so the whole document reads as one uniform type system.
  quote: { flexDirection: "row", marginTop: 2, marginBottom: 20 },
  quoteBar: { width: 2.5, borderRadius: 2, backgroundColor: C.gold, marginRight: 14 },
  quoteContent: { flex: 1 },
  quoteBody: { fontFamily: SANS, fontSize: T.body, lineHeight: 1.6, color: C.ink, marginTop: 3 },

  actie: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  actieText: { fontSize: T.body, color: C.ink },
  actieValue: { fontSize: T.body, color: C.muted },

  table: { marginTop: 4 },
  th: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 4, marginBottom: 2 },
  thText: { fontSize: T.micro, color: C.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  // Outcome-group subheader (Win/BE/Loss + subtotal) between the column header and
  // that bucket's rows, so the PDF mirrors the on-screen grouped default view.
  groupSubhead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.surface2, paddingVertical: 3, paddingHorizontal: 6, marginTop: 6, marginBottom: 1, borderRadius: 3 },
  groupSubheadLabel: { fontFamily: SANS_BOLD, fontSize: T.small, color: C.ink, letterSpacing: 0.3 },
  groupSubheadTotal: { fontFamily: SANS_BOLD, fontSize: T.small },
  tr: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
  td: { fontSize: T.small, color: C.ink },
  cDate: { width: "13%", paddingRight: 4 },
  cPair: { width: "13%", paddingRight: 4 },
  cConcept: { width: "19%", paddingRight: 4 },
  cEntry: { width: "16%", paddingRight: 4 },
  cOut: { width: "12%", paddingRight: 4 },
  cRes: { width: "12%", textAlign: "right", paddingRight: 4 },
  cEval: { width: "15%" },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
  },
  footerRule: { height: 1.5, backgroundColor: C.gold, marginBottom: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBrand: { fontFamily: SANS_BOLD, fontSize: T.small, color: C.ink, letterSpacing: 0.3 },
  footerEye: { color: C.gold },
  footerText: { fontSize: T.micro, color: C.faint, letterSpacing: 0.4 },
});

function outcomeColor(o: string): string {
  return o === "Win" ? C.win : o === "Loss" ? C.loss : C.be;
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function WinLossDonut({ wins, be, losses, labels, caption }: { wins: number; be: number; losses: number; labels: string[]; caption: string }) {
  const total = wins + be + losses;
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const rO = size / 2 - 3;
  const rI = rO * 0.6;
  const rMid = (rO + rI) / 2;
  const thickness = rO - rI;
  const [wLabel, beLabel, lLabel] = labels;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const polar = (r: number, deg: number): [number, number] => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (startDeg: number, endDeg: number, color: string, key: string) => {
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const [x0o, y0o] = polar(rO, startDeg);
    const [x1o, y1o] = polar(rO, endDeg);
    const [x1i, y1i] = polar(rI, endDeg);
    const [x0i, y0i] = polar(rI, startDeg);
    const d = `M ${x0o} ${y0o} A ${rO} ${rO} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rI} ${rI} 0 ${large} 0 ${x0i} ${y0i} Z`;
    return <Path key={key} d={d} fill={color} />;
  };

  const segs = [
    { n: wins, c: C.win, k: "w" },
    { n: be, c: C.be, k: "b" },
    { n: losses, c: C.loss, k: "l" },
  ].filter((s) => s.n > 0);

  // A single 100% slice can't be drawn as one arc (start === end point), and the
  // empty state needs a neutral ring — both render cleanly as a stroked circle.
  const ring = (color: string) => (
    <Circle cx={cx} cy={cy} r={rMid} fill="none" stroke={color} strokeWidth={thickness} />
  );

  let acc = 0;
  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size, position: "relative" }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total === 0
            ? ring(C.border)
            : segs.length === 1
              ? ring(segs[0].c)
              : segs.map((s) => {
                  const start = (acc / total) * 360;
                  acc += s.n;
                  const end = (acc / total) * 360;
                  return arc(start, end, s.c, s.k);
                })}
        </Svg>
        {/* Center label overlaid via flexbox — reliable centering, unlike SVG text anchoring. */}
        <View style={styles.donutCenter}>
          <Text style={styles.donutPct}>{total > 0 ? `${winPct}%` : "—"}</Text>
          <Text style={styles.donutCaption}>{caption}</Text>
        </View>
      </View>
      <View style={styles.wlLegend}>
        <View style={styles.wlLegendItem}>
          <View style={[styles.wlDot, { backgroundColor: C.win }]} />
          <Text style={styles.wlLegendText}>{wLabel}</Text>
        </View>
        <View style={styles.wlLegendItem}>
          <View style={[styles.wlDot, { backgroundColor: C.be }]} />
          <Text style={styles.wlLegendText}>{beLabel}</Text>
        </View>
        <View style={styles.wlLegendItem}>
          <View style={[styles.wlDot, { backgroundColor: C.loss }]} />
          <Text style={styles.wlLegendText}>{lLabel}</Text>
        </View>
      </View>
    </View>
  );
}

function EquitySparkline({ equity, xLabel, unit }: { equity: number[]; xLabel: string; unit: ResultUnit }) {
  const w = 300;
  const h = 86;
  const mR = 8;
  const mT = 8;
  const mB = 22; // room for the trade-count (x) axis labels + title
  if (equity.length === 0) return <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;

  const series = [0, ...equity];
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 1;

  // Compacte as-labels: 1 decimaal voor %/R, hele euro's voor geld.
  const fmtPct = (v: number) => formatAggregate(Math.round(v * 10) / 10, unit, { decimals: unit === "currency" ? 0 : 1 });
  // y ticks: peak, zero and trough — deduped, only those inside the range.
  const yTicks = Array.from(new Set([max, 0, min])).filter((v) => v >= min && v <= max);
  // De y-gutter groeit mee met het breedste label (~3.4pt per teken op 6pt
  // Helvetica): een geld-label als "+€12.500" is veel breder dan "+4.9%" en zou
  // met een vaste 26pt links uit de viewBox clippen (react-pdf knipt SVG-inhoud af).
  const mL = Math.max(26, 4 + Math.max(...yTicks.map((v) => fmtPct(v).length)) * 3.4);
  const plotL = mL;
  const plotR = w - mR;
  const plotT = mT;
  const plotB = h - mB;
  const stepX = (plotR - plotL) / Math.max(1, series.length - 1);
  const xOf = (i: number) => plotL + i * stepX;
  const yOf = (v: number) => plotT + (1 - (v - min) / span) * (plotB - plotT);
  const coords = series.map((v, i) => ({ x: xOf(i), y: yOf(v) }));
  const points = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const zeroY = yOf(0);
  // The cumulative-result curve uses the brand gold on every surface (matching the
  // on-screen EquityCurveChart), not a green/red sign-based color.
  const line = C.gold;

  // Deepest drawdown (peak → trough) over the baseline-anchored series, so the PDF
  // annotates the same max-drawdown the on-screen chart marks with peak/trough dots.
  let ddPeakVal = series[0];
  let ddPeakIdx = 0;
  let ddDepth = 0;
  let ddMarkPeakIdx = -1;
  let ddMarkTroughIdx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i] > ddPeakVal) {
      ddPeakVal = series[i];
      ddPeakIdx = i;
    }
    const drop = ddPeakVal - series[i];
    if (drop > ddDepth) {
      ddDepth = drop;
      ddMarkPeakIdx = ddPeakIdx;
      ddMarkTroughIdx = i;
    }
  }
  const hasDrawdown = ddDepth > 0 && ddMarkTroughIdx >= 0;
  // Faint area between the curve and the zero line, so the trend reads as a shape.
  const areaPoints = `${coords[0].x},${zeroY} ${points} ${coords[coords.length - 1].x},${zeroY}`;

  // x ticks: trade index (0 = start). Thin out when there are many trades.
  const n = series.length;
  const xTicks =
    n <= 13
      ? series.map((_, i) => i)
      : Array.from(new Set(Array.from({ length: 6 }, (_, k) => Math.round((k * (n - 1)) / 5))));

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      {/* axes */}
      <Line x1={plotL} y1={plotT} x2={plotL} y2={plotB} strokeWidth={0.5} stroke={C.border} />
      <Line x1={plotL} y1={plotB} x2={plotR} y2={plotB} strokeWidth={0.5} stroke={C.border} />
      <Line x1={plotL} y1={zeroY} x2={plotR} y2={zeroY} strokeWidth={0.5} stroke={C.border} strokeDasharray="2 2" />
      {/* y-axis (%) labels */}
      {yTicks.map((v, i) => (
        <Text key={`y${i}`} x={plotL - 3} y={yOf(v) + 2} textAnchor="end" fill={C.muted} style={{ fontSize: T.chart, fontFamily: SANS }}>
          {fmtPct(v)}
        </Text>
      ))}
      {/* area + line + points */}
      <Polygon points={areaPoints} fill={line} fillOpacity={0.08} stroke="none" />
      <Polyline points={points} fill="none" stroke={line} strokeWidth={1.5} />
      {coords.map((p, i) => {
        const last = i === coords.length - 1;
        return (
          <Circle key={i} cx={p.x} cy={p.y} r={last ? 2.8 : 1.9} fill={i === 0 ? C.faint : line} stroke={C.paper} strokeWidth={0.6} />
        );
      })}
      {/* deepest-drawdown markers: hollow peak dot (skipped when the peak is the
          synthetic baseline), filled trough dot, and a signed depth label. */}
      {hasDrawdown && ddMarkPeakIdx > 0 ? (
        <Circle cx={coords[ddMarkPeakIdx].x} cy={coords[ddMarkPeakIdx].y} r={3} fill={C.paper} stroke={C.muted} strokeWidth={1.2} />
      ) : null}
      {hasDrawdown ? (
        <Circle cx={coords[ddMarkTroughIdx].x} cy={coords[ddMarkTroughIdx].y} r={3} fill={C.loss} stroke={C.paper} strokeWidth={1} />
      ) : null}
      {hasDrawdown ? (
        <Text
          x={coords[ddMarkTroughIdx].x}
          y={coords[ddMarkTroughIdx].y - 4}
          textAnchor="middle"
          fill={C.loss}
          style={{ fontSize: T.chart, fontFamily: SANS }}
        >
          {formatAggregate(-ddDepth, unit, { decimals: unit === "currency" ? 0 : 1 })}
        </Text>
      ) : null}
      {/* x-axis (trade count) labels */}
      {xTicks.map((i) => (
        <Text key={`x${i}`} x={xOf(i)} y={plotB + 8} textAnchor="middle" fill={C.muted} style={{ fontSize: T.chart, fontFamily: SANS }}>
          {i}
        </Text>
      ))}
      {/* x-axis title */}
      <Text x={(plotL + plotR) / 2} y={h - 2} textAnchor="middle" fill={C.faint} style={{ fontSize: T.chart, fontFamily: SANS }}>
        {xLabel}
      </Text>
    </Svg>
  );
}

function StatusMarker({ status }: { status: ReviewPdfActie["status"] }) {
  const fill = status === "ok" ? C.win : status === "niet-ok" ? C.loss : "none";
  const stroke = status === null ? C.faint : fill;
  return (
    <Svg width={9} height={9} viewBox="0 0 9 9">
      <Rect x={0.75} y={0.75} width={7.5} height={7.5} rx={1.5} fill={fill} stroke={stroke} strokeWidth={1} />
    </Svg>
  );
}

function Section({ s }: { s: ReviewPdfSection }) {
  // The takeaway is the one pull-quote; every other kind (text / voice / overall)
  // shares the single plain treatment for a uniform editorial column.
  if (s.kind === "takeaway") {
    return (
      <View style={styles.quote} wrap={false}>
        <View style={styles.quoteBar} />
        <View style={styles.quoteContent}>
          <Text style={styles.sectionLabel}>{s.label}</Text>
          <Text style={styles.quoteBody}>&ldquo;{s.body}&rdquo;</Text>
        </View>
      </View>
    );
  }
  // The acties/werkpunten checklist renders inline at its configured position
  // (mirrors the on-screen section order), not forced to the end of the document.
  if (s.kind === "acties") {
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionLabel}>{s.label}</Text>
        {(s.acties ?? []).map((a, i) => (
          <View style={styles.actie} key={i}>
            <StatusMarker status={a.status} />
            <Text style={styles.actieText}>{a.label}</Text>
            {a.value ? <Text style={styles.actieValue}>— {a.value}</Text> : null}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionLabel}>{s.label}</Text>
      <Text style={styles.sectionBody}>{s.body}</Text>
    </View>
  );
}

// A trade table taller than this can't fit on a single A4 body, so it's allowed
// to flow across pages — keeping it together (wrap={false}) would clip the
// overflow. Below the threshold the whole section is kept on one sheet.
const TABLE_ROWS_PER_PAGE = 28;

function TradeSection({ heading, groups, labels, unit }: { heading: string; groups: ReviewPdfTradeGroup[]; labels: ReviewPdfData["labels"]; unit: ResultUnit }) {
  const totalRows = groups.reduce((n, g) => n + g.count, 0);
  // Group subheaders add rows too, so a small section still fits one page below the threshold.
  const fitsOnePage = totalRows + groups.length <= TABLE_ROWS_PER_PAGE;
  return (
    <View style={styles.section} wrap={!fitsOnePage}>
      <Text style={styles.sectionLabel}>
        {heading} ({totalRows})
      </Text>
      <View style={styles.table}>
        <TradeTableHeader labels={labels} />
        {groups.map((g, i) => (
          <TradeGroupBlock key={i} group={g} labels={labels} unit={unit} />
        ))}
      </View>
    </View>
  );
}

function TradeTableHeader({ labels }: { labels: ReviewPdfData["labels"] }) {
  return (
    <View style={styles.th}>
      <Text style={[styles.thText, styles.cDate]}>{labels.colDate}</Text>
      <Text style={[styles.thText, styles.cPair]}>{labels.colPair}</Text>
      <Text style={[styles.thText, styles.cConcept]}>{labels.colConcept}</Text>
      <Text style={[styles.thText, styles.cEntry]}>{labels.colEntry}</Text>
      <Text style={[styles.thText, styles.cOut]}>{labels.colOutcome}</Text>
      <Text style={[styles.thText, styles.cRes]}>{labels.colResult}</Text>
      <Text style={[styles.thText, styles.cEval]}>{labels.colEval}</Text>
    </View>
  );
}

// One outcome bucket: a Win/BE/Loss subheader (with subtotal for taken groups)
// followed by that bucket's rows — the printed equivalent of the on-screen
// collapsible group.
function TradeGroupBlock({ group, labels, unit }: { group: ReviewPdfTradeGroup; labels: ReviewPdfData["labels"]; unit: ResultUnit }) {
  const totalColor = group.subtotal == null ? C.muted : group.subtotal > 0 ? C.win : group.subtotal < 0 ? C.loss : C.be;
  return (
    <View wrap={group.rows.length > TABLE_ROWS_PER_PAGE}>
      <View style={styles.groupSubhead} wrap={false}>
        <Text style={styles.groupSubheadLabel}>
          {group.label} · {group.count}
        </Text>
        {group.subtotal != null ? (
          <Text style={[styles.groupSubheadTotal, { color: totalColor }]}>{formatAggregate(group.subtotal, unit)}</Text>
        ) : null}
      </View>
      {group.rows.map((r, i) => (
        <View style={styles.tr} key={i} wrap={false}>
          <Text style={[styles.td, styles.cDate]}>{r.datum}</Text>
          <Text style={[styles.td, styles.cPair]}>{r.pair}</Text>
          <Text style={[styles.td, styles.cConcept, { color: C.muted }]}>{r.concept ?? "—"}</Text>
          <Text style={[styles.td, styles.cEntry, { color: C.muted }]}>{r.entry ?? "—"}</Text>
          {/* Open trade: no outcome/result yet — mirror the on-screen "loopt" badge + "—". */}
          <Text style={[styles.td, styles.cOut, { color: r.open ? C.gold : outcomeColor(r.outcome ?? "") }]}>{r.open ? labels.openBadge : r.outcome}</Text>
          <Text style={[styles.td, styles.cRes, { color: r.resultaat == null ? C.faint : r.resultaat >= 0 ? C.win : C.loss }]}>
            {r.resultaat == null ? "—" : formatAggregate(r.resultaat, unit)}
          </Text>
          <Text style={[styles.td, styles.cEval, { color: C.muted }]}>{r.evaluation ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReviewPdfDocument({ data }: { data: ReviewPdfData }) {
  const { kpis, labels } = data;
  const wlLabels = [`${kpis.wins}W`, `${kpis.be}BE`, `${kpis.losses}L`];

  return (
    <Document title={`Beyen — ${data.heading}`} author="Beyen Invest">
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed={false}>
          <View style={styles.bandTopRow}>
            <View>
              <Text style={styles.wordmark}>
                b<Text style={styles.eye}>eye</Text>n
              </Text>
              <Text style={styles.tagline}>{data.labels.tagline}</Text>
            </View>
            <View style={styles.headingWrap}>
              <Text style={styles.heading}>{data.heading}</Text>
              {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}
              <Text style={styles.generatedOn}>
                {labels.generatedOn} {data.generatedOn}
              </Text>
            </View>
          </View>

          {/* Personal masthead: the trader's name centered and prominent inside the
              ink band, so the document reads as addressed to them. */}
          {data.traderName ? (
            <View style={styles.personalBand}>
              <Text style={styles.personalEyebrow}>{labels.preparedFor}</Text>
              <Text style={styles.personalName}>{data.traderName}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.bandRule} />

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>{labels.resultHeading}</Text>
          <View style={styles.kpiRow}>
            <Kpi label={labels.kpiTrades} value={String(kpis.trades)} />
            <Kpi label={labels.kpiTotal} value={formatAggregate(kpis.resultaat, data.unit)} color={kpis.resultaat >= 0 ? C.win : C.loss} />
            <Kpi label={labels.kpiAvgRR} value={formatAggregate(kpis.avgRR, data.unit)} color={kpis.avgRR >= 0 ? C.win : C.loss} />
          </View>

          {kpis.trades > 0 ? (
            <View style={styles.chartsRow}>
              <View style={[styles.chartBox, { width: "34%" }]}>
                <Text style={styles.chartLabel}>{labels.winRate}</Text>
                <WinLossDonut wins={kpis.wins} be={kpis.be} losses={kpis.losses} labels={wlLabels} caption={labels.winRate} />
              </View>
              <View style={[styles.chartBox, { flex: 1 }]}>
                <Text style={styles.chartLabel}>{labels.cumulative}</Text>
                <View style={styles.chartBody}>
                  <EquitySparkline equity={data.equity} xLabel={labels.chartXTrades} unit={data.unit} />
                </View>
              </View>
            </View>
          ) : null}

          {data.errorLine ? <Text style={styles.errorLine}>{data.errorLine}</Text> : null}

          {data.sections.map((s, i) => (
            <Section key={i} s={s} />
          ))}

          {data.takenGroups.length > 0 ? (
            <TradeSection heading={labels.takenHeading} groups={data.takenGroups} labels={labels} unit={data.unit} />
          ) : null}

          {data.missedGroups.length > 0 ? (
            <TradeSection heading={labels.missedHeading} groups={data.missedGroups} labels={labels} unit={data.unit} />
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text style={styles.footerBrand}>
              b<Text style={styles.footerEye}>eye</Text>n
            </Text>
            <Text style={styles.footerText}>beyen.app</Text>
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
