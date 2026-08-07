import { Document, Page, Text, View, StyleSheet, Svg, Polyline, Line, Rect } from "@react-pdf/renderer";
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
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: SANS, fontSize: 9, paddingBottom: 46 },

  band: {
    backgroundColor: C.inkBand,
    paddingVertical: 20,
    paddingHorizontal: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  wordmark: { fontFamily: SANS_BOLD, fontSize: 20, color: C.onDark, letterSpacing: 0.5 },
  eye: { color: C.goldOnDark },
  tagline: { fontFamily: SANS, fontSize: 7.5, color: C.goldOnDark, letterSpacing: 2, marginTop: 4 },
  headingWrap: { alignItems: "flex-end" },
  heading: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: 26, color: C.goldOnDark },
  subtitle: { fontFamily: SANS, fontSize: 9, color: C.faint, marginTop: 3, maxWidth: 240, textAlign: "right" },
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

  wlBarTrack: { flexDirection: "row", height: 14, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  wlLegend: { flexDirection: "row", gap: 14 },
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
  thText: { fontSize: 7.5, color: C.muted, letterSpacing: 0.6, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
  td: { fontSize: 8.5, color: C.ink },
  cDate: { width: "20%" },
  cPair: { width: "22%" },
  cOut: { width: "16%" },
  cRes: { width: "16%", textAlign: "right" },
  cEval: { width: "26%", textAlign: "right" },
  missedBadge: {
    fontFamily: SANS_BOLD,
    fontSize: 6.5,
    color: C.loss,
    letterSpacing: 0.5,
  },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerBrand: { fontFamily: SANS_BOLD, fontSize: 8, color: C.ink },
  footerText: { fontSize: 7.5, color: C.faint },
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

function WinLossBar({ wins, be, losses, labels }: { wins: number; be: number; losses: number; labels: string[] }) {
  const total = wins + be + losses;
  const seg = (n: number, color: string) =>
    total > 0 && n > 0 ? <View style={{ width: `${(n / total) * 100}%`, backgroundColor: color }} /> : null;
  const [wLabel, beLabel, lLabel] = labels;
  return (
    <View>
      <View style={[styles.wlBarTrack, total === 0 ? { backgroundColor: C.surface2 } : {}]}>
        {seg(wins, C.win)}
        {seg(be, C.be)}
        {seg(losses, C.loss)}
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

function EquitySparkline({ equity }: { equity: number[] }) {
  const w = 300;
  const h = 60;
  const pad = 4;
  if (equity.length === 0) return <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} />;

  const series = [0, ...equity];
  const min = Math.min(0, ...series);
  const max = Math.max(0, ...series);
  const span = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(1, series.length - 1);
  const yOf = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const points = series.map((v, i) => `${pad + i * stepX},${yOf(v)}`).join(" ");
  const zeroY = yOf(0);
  const up = equity[equity.length - 1] >= 0;

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} strokeWidth={0.5} stroke={C.border} strokeDasharray="2 2" />
      <Polyline points={points} fill="none" stroke={up ? C.win : C.loss} strokeWidth={1.5} />
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
    <View style={styles.section}>
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
        <Text style={[styles.thText, styles.cOut]}>{labels.colOutcome}</Text>
        <Text style={[styles.thText, styles.cRes]}>{labels.colResult}</Text>
        <Text style={[styles.thText, styles.cEval]}>{labels.colEval}</Text>
      </View>
      {rows.map((r, i) => (
        <View style={styles.tr} key={i} wrap={false}>
          <Text style={[styles.td, styles.cDate]}>{r.datum}</Text>
          <Text style={[styles.td, styles.cPair]}>{r.pair}</Text>
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
            <Text style={styles.heading}>{data.heading}</Text>
            {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}
            <Text style={styles.generatedOn}>
              {labels.generatedOn} {data.generatedOn}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>{labels.resultHeading}</Text>
          <View style={styles.kpiRow}>
            <Kpi label={labels.kpiTrades} value={String(kpis.trades)} />
            <Kpi label={labels.kpiTotal} value={signed(kpis.resultaat)} color={kpis.resultaat >= 0 ? C.win : C.loss} />
            <Kpi label={labels.kpiAvgRR} value={signed(kpis.avgRR)} color={kpis.avgRR >= 0 ? C.win : C.loss} />
          </View>

          {kpis.trades > 0 ? (
            <View style={styles.chartsRow}>
              <View style={[styles.chartBox, { width: "38%" }]}>
                <Text style={styles.chartLabel}>{labels.winRate}</Text>
                <WinLossBar wins={kpis.wins} be={kpis.be} losses={kpis.losses} labels={wlLabels} />
              </View>
              <View style={[styles.chartBox, { flex: 1 }]}>
                <Text style={styles.chartLabel}>{labels.cumulative}</Text>
                <EquitySparkline equity={data.equity} />
              </View>
            </View>
          ) : null}

          {data.errorLine ? <Text style={styles.errorLine}>{data.errorLine}</Text> : null}

          {data.sections.map((s, i) => (
            <Section key={i} s={s} />
          ))}

          {data.acties.length > 0 ? (
            <View style={styles.section}>
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
          <Text style={styles.footerBrand}>beyen</Text>
          <Text style={styles.footerText}>beyen.app</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
