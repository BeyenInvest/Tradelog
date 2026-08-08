import { Document, Page, Text, View, StyleSheet, Svg, Polyline, Polygon, Line, Rect, Circle, Path } from "@react-pdf/renderer";
import type { ReviewPdfData, ReviewPdfSection, ReviewPdfTradeRow, ReviewPdfActie } from "./reviewPdfData";

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
const SANS_ITALIC = "Helvetica-Oblique";
// The app's display serif, embedded via registerPdfFonts (call ensurePdfFonts()
// before rendering). Matches the on-screen font-display face used for review
// headings and the takeaway pull-quote.
const DISPLAY = "InstrumentSerif";

const styles = StyleSheet.create({
  // paddingTop gives every *continuation* page a clean top margin; the header band
  // cancels it with a negative marginTop so it still bleeds to the very top of page 1.
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: SANS, fontSize: 9, paddingTop: 34, paddingBottom: 48 },

  band: {
    marginTop: -34,
    backgroundColor: C.inkBand,
    paddingTop: 22,
    paddingBottom: 20,
    paddingHorizontal: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bandRule: { height: 3, backgroundColor: C.gold },
  wordmark: { fontFamily: SANS_BOLD, fontSize: 22, color: C.onDark, letterSpacing: 0.5 },
  eye: { color: C.goldOnDark },
  tagline: { fontFamily: SANS, fontSize: 7.5, color: C.goldOnDark, letterSpacing: 2.2, marginTop: 6 },
  headingWrap: { alignItems: "flex-end", maxWidth: 300 },
  preparedFor: { fontFamily: SANS_BOLD, fontSize: 7, color: C.goldOnDark, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 3 },
  traderName: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: 15, color: C.onDark, marginBottom: 6, textAlign: "right" },
  heading: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: 24, color: C.goldOnDark },
  subtitle: { fontFamily: SANS, fontSize: 9, color: C.faint, marginTop: 3, maxWidth: 260, textAlign: "right" },
  generatedOn: { fontFamily: SANS, fontSize: 7, color: C.faint, marginTop: 5 },

  body: { paddingHorizontal: 40, paddingTop: 22 },

  sectionLabel: {
    fontFamily: SANS_BOLD,
    fontSize: 8,
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
  kpiLabel: { fontSize: 7.5, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  kpiValue: { fontFamily: SANS_BOLD, fontSize: 17 },

  chartsRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  chartBox: { borderWidth: 0.5, borderColor: C.border, borderRadius: 6, padding: 12 },
  chartLabel: { fontSize: 7.5, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },

  donutWrap: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  donutPct: { fontFamily: SANS_BOLD, fontSize: 14, color: C.ink, lineHeight: 1, textAlign: "center" },
  chartBody: { flexGrow: 1, justifyContent: "center" },
  wlLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 10 },
  wlLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  wlDot: { width: 7, height: 7, borderRadius: 2 },
  wlLegendText: { fontSize: 8, color: C.ink },

  errorLine: { fontSize: 8, color: C.muted, marginBottom: 18 },

  section: { marginBottom: 14 },
  sectionBody: { fontSize: 9.5, lineHeight: 1.55, color: C.ink },
  voiceBox: {
    backgroundColor: C.surface2,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  voiceBody: { fontFamily: SANS_ITALIC, fontSize: 9.5, lineHeight: 1.55, color: C.ink },
  takeawayBox: {
    borderWidth: 0.5,
    borderColor: C.gold,
    backgroundColor: "#FBF6EA",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  takeawayBody: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: 17, lineHeight: 1.3, color: C.ink },
  overallBox: {
    borderWidth: 0.5,
    borderColor: C.gold,
    backgroundColor: "#FBF6EA",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },

  actie: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 },
  actieText: { fontSize: 9.5, color: C.ink },
  actieValue: { fontSize: 9.5, color: C.muted },

  table: { marginTop: 4 },
  th: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 4, marginBottom: 2 },
  thText: { fontSize: 7, color: C.muted, letterSpacing: 0.5, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
  td: { fontSize: 8, color: C.ink },
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
  footerBrand: { fontFamily: SANS_BOLD, fontSize: 8.5, color: C.ink, letterSpacing: 0.3 },
  footerEye: { color: C.gold },
  footerText: { fontSize: 7.5, color: C.faint, letterSpacing: 0.4 },
});

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

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

function WinLossDonut({ wins, be, losses, labels }: { wins: number; be: number; losses: number; labels: string[] }) {
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
            ? ring(C.surface2)
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

function EquitySparkline({ equity, xLabel }: { equity: number[]; xLabel: string }) {
  const w = 300;
  const h = 86;
  const mL = 26; // room for the % (y) axis labels
  const mR = 8;
  const mT = 8;
  const mB = 22; // room for the trade-count (x) axis labels + title
  if (equity.length === 0) return <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;

  const series = [0, ...equity];
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 1;
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
  const up = equity[equity.length - 1] >= 0;
  const line = up ? C.win : C.loss;
  // Faint area between the curve and the zero line, so the trend reads as a shape.
  const areaPoints = `${coords[0].x},${zeroY} ${points} ${coords[coords.length - 1].x},${zeroY}`;

  const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10}%`;
  // y ticks: peak, zero and trough — deduped, only those inside the range.
  const yTicks = Array.from(new Set([max, 0, min])).filter((v) => v >= min && v <= max);
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
        <Text key={`y${i}`} x={plotL - 3} y={yOf(v) + 2} textAnchor="end" fill={C.muted} style={{ fontSize: 6, fontFamily: SANS }}>
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
      {/* x-axis (trade count) labels */}
      {xTicks.map((i) => (
        <Text key={`x${i}`} x={xOf(i)} y={plotB + 8} textAnchor="middle" fill={C.muted} style={{ fontSize: 6, fontFamily: SANS }}>
          {i}
        </Text>
      ))}
      {/* x-axis title */}
      <Text x={(plotL + plotR) / 2} y={h - 2} textAnchor="middle" fill={C.faint} style={{ fontSize: 5.5, fontFamily: SANS }}>
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
  if (s.kind === "voice") {
    return (
      <View style={styles.voiceBox} wrap={false}>
        <Text style={styles.sectionLabel}>{s.label}</Text>
        <Text style={styles.voiceBody}>{s.body}</Text>
      </View>
    );
  }
  if (s.kind === "takeaway") {
    return (
      <View style={styles.takeawayBox} wrap={false}>
        <Text style={styles.sectionLabel}>{s.label}</Text>
        <Text style={styles.takeawayBody}>&ldquo;{s.body}&rdquo;</Text>
      </View>
    );
  }
  if (s.kind === "overall") {
    return (
      <View style={styles.overallBox} wrap={false}>
        <Text style={styles.sectionLabel}>{s.label}</Text>
        <Text style={styles.sectionBody}>{s.body}</Text>
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

function TradeTable({ rows, labels }: { rows: ReviewPdfTradeRow[]; labels: ReviewPdfData["labels"] }) {
  return (
    <View style={styles.table}>
      <View style={styles.th}>
        <Text style={[styles.thText, styles.cDate]}>{labels.colDate}</Text>
        <Text style={[styles.thText, styles.cPair]}>{labels.colPair}</Text>
        <Text style={[styles.thText, styles.cConcept]}>{labels.colConcept}</Text>
        <Text style={[styles.thText, styles.cEntry]}>{labels.colEntry}</Text>
        <Text style={[styles.thText, styles.cOut]}>{labels.colOutcome}</Text>
        <Text style={[styles.thText, styles.cRes]}>{labels.colResult}</Text>
        <Text style={[styles.thText, styles.cEval]}>{labels.colEval}</Text>
      </View>
      {rows.map((r, i) => (
        <View style={styles.tr} key={i} wrap={false}>
          <Text style={[styles.td, styles.cDate]}>{r.datum}</Text>
          <Text style={[styles.td, styles.cPair]}>{r.pair}</Text>
          <Text style={[styles.td, styles.cConcept, { color: C.muted }]}>{r.concept ?? "—"}</Text>
          <Text style={[styles.td, styles.cEntry, { color: C.muted }]}>{r.entry ?? "—"}</Text>
          <Text style={[styles.td, styles.cOut, { color: outcomeColor(r.outcome) }]}>{r.outcome}</Text>
          <Text style={[styles.td, styles.cRes, { color: r.resultaat >= 0 ? C.win : C.loss }]}>{signed(r.resultaat)}</Text>
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
          <View>
            <Text style={styles.wordmark}>
              b<Text style={styles.eye}>eye</Text>n
            </Text>
            <Text style={styles.tagline}>{data.labels.tagline}</Text>
          </View>
          <View style={styles.headingWrap}>
            {data.traderName ? <Text style={styles.preparedFor}>{labels.preparedFor}</Text> : null}
            {data.traderName ? <Text style={styles.traderName}>{data.traderName}</Text> : null}
            <Text style={styles.heading}>{data.heading}</Text>
            {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}
            <Text style={styles.generatedOn}>
              {labels.generatedOn} {data.generatedOn}
            </Text>
          </View>
        </View>
        <View style={styles.bandRule} />

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>{labels.resultHeading}</Text>
          <View style={styles.kpiRow}>
            <Kpi label={labels.kpiTrades} value={String(kpis.trades)} />
            <Kpi label={labels.kpiTotal} value={signed(kpis.resultaat)} color={kpis.resultaat >= 0 ? C.win : C.loss} />
            <Kpi label={labels.kpiAvgRR} value={signed(kpis.avgRR)} color={kpis.avgRR >= 0 ? C.win : C.loss} />
          </View>

          {kpis.trades > 0 ? (
            <View style={styles.chartsRow}>
              <View style={[styles.chartBox, { width: "34%" }]}>
                <Text style={styles.chartLabel}>{labels.winRate}</Text>
                <WinLossDonut wins={kpis.wins} be={kpis.be} losses={kpis.losses} labels={wlLabels} />
              </View>
              <View style={[styles.chartBox, { flex: 1 }]}>
                <Text style={styles.chartLabel}>{labels.cumulative}</Text>
                <View style={styles.chartBody}>
                  <EquitySparkline equity={data.equity} xLabel={labels.chartXTrades} />
                </View>
              </View>
            </View>
          ) : null}

          {data.errorLine ? <Text style={styles.errorLine}>{data.errorLine}</Text> : null}

          {data.sections.map((s, i) => (
            <Section key={i} s={s} />
          ))}

          {data.acties.length > 0 ? (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionLabel}>{labels.actiesLabel}</Text>
              {data.acties.map((a, i) => (
                <View style={styles.actie} key={i}>
                  <StatusMarker status={a.status} />
                  <Text style={styles.actieText}>{a.label}</Text>
                  {a.value ? <Text style={styles.actieValue}>— {a.value}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {data.takenRows.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {labels.takenHeading} ({data.takenRows.length})
              </Text>
              <TradeTable rows={data.takenRows} labels={labels} />
            </View>
          ) : null}

          {data.missedRows.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {labels.missedHeading} ({data.missedRows.length})
              </Text>
              <TradeTable rows={data.missedRows} labels={labels} />
            </View>
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
