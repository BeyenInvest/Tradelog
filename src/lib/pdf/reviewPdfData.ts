import type { TFunction } from "i18next";
import type { Outcome, PeriodType, ResultUnit } from "@/lib/constants";
import type { PeriodicReview, WeeklyReview } from "@/lib/types";
import { computeOverviewKpis, computeErrorCounts, sortChronological, round2, type ClosedTrade } from "@/lib/stats";
import { formatAggregate, tradesInResultUnit } from "@/lib/format";
import { periodLabel } from "@/lib/periodRanges";

/**
 * Pure adapter: turns a weekly or periodic review + its taken/missed trades into
 * a flat, presentation-ready shape for the branded PDF (src/lib/pdf/ReviewPdfDocument).
 *
 * Every real number here (KPIs, equity curve) is derived from the *taken* trades
 * only — missed trades are hypothetical and must never dilute real performance
 * (see the domain rule in CLAUDE.md). Missed trades appear solely as their own
 * labelled list + error line, exactly like the on-screen review.
 */

export type ReviewSectionKind = "text" | "voice" | "takeaway" | "overall";

export interface ReviewPdfSection {
  label: string;
  body: string;
  kind: ReviewSectionKind;
}

export interface ReviewPdfActie {
  label: string;
  status: "ok" | "niet-ok" | null;
  value: string | null;
}

export interface ReviewPdfTradeRow {
  datum: string;
  pair: string;
  concept: string | null;
  entry: string | null;
  outcome: Outcome;
  resultaat: number;
  evaluation: string | null;
  missed: boolean;
}

export interface ReviewPdfKpis {
  trades: number;
  resultaat: number;
  avgRR: number;
  wins: number;
  be: number;
  losses: number;
}

export interface ReviewPdfLabels {
  tagline: string;
  generatedOn: string;
  resultHeading: string;
  kpiTrades: string;
  kpiTotal: string;
  kpiAvgRR: string;
  winRate: string;
  cumulative: string;
  chartXTrades: string;
  actiesLabel: string;
  takenHeading: string;
  missedHeading: string;
  noTrades: string;
  colDate: string;
  colPair: string;
  colConcept: string;
  colEntry: string;
  colOutcome: string;
  colResult: string;
  colEval: string;
  preparedFor: string;
}

export interface ReviewPdfData {
  heading: string;
  subtitle: string | null;
  /** The signed-in trader's display name, for the personalised header. Null if unset. */
  traderName: string | null;
  generatedOn: string;
  kpis: ReviewPdfKpis;
  /** De resultaat-eenheid waarin alle getallen hierin al staan (Fase J) — het document formatteert ermee via formatAggregate. */
  unit: ResultUnit;
  /** Cumulative resultaat after each taken trade, chronological. Empty if no taken trades. */
  equity: number[];
  errorLine: string | null;
  sections: ReviewPdfSection[];
  acties: ReviewPdfActie[];
  takenRows: ReviewPdfTradeRow[];
  missedRows: ReviewPdfTradeRow[];
  labels: ReviewPdfLabels;
}

export type ReviewPdfInput = (
  | {
      kind: "weekly";
      review: WeeklyReview;
      taken: ClosedTrade[];
      missed: ClosedTrade[];
    }
  | { kind: "periodic"; review: PeriodicReview; taken: ClosedTrade[]; missed: ClosedTrade[] }
) & {
  /** The signed-in trader's display name (profile.display_name), for the header. */
  traderName?: string | null;
  /**
   * Resultaat-eenheid van de kijker (Fase J) — default 'percent'. In R/geld-modus
   * worden alle bedragen (KPI's, equity, traderijen, error-regel) vooraf omgerekend
   * via tradesInResultUnit, zodat de PDF exact het scherm volgt.
   */
  resultUnit?: ResultUnit;
  /** Actief account-saldo (uit useResultDisplay) — vereist voor 'currency'; zonder saldo valt de PDF terug op %. */
  saldo?: number | null;
};


/**
 * Mirrors parseActie in ReviewContentBlocks.tsx — kept in sync deliberately, but
 * duplicated here so the pure PDF-data layer has no dependency on a React
 * component. "Label: ok" / "Label: niet ok" become a checkable item; anything
 * else is a plain bullet (or "Label — value").
 */
function parseActie(a: string): ReviewPdfActie {
  const m = a.match(/^(.+?):\s*(.+)$/);
  if (!m) return { label: a, status: null, value: null };
  const value = m[2].trim();
  const normalized = value.toLowerCase();
  const status = normalized === "ok" ? "ok" : normalized === "niet ok" || normalized === "not ok" ? "niet-ok" : null;
  return { label: m[1].trim(), status, value: status ? null : value };
}

function toRow(t: ClosedTrade, missed: boolean): ReviewPdfTradeRow {
  return {
    datum: t.datum_open,
    pair: t.instrument ?? t.pair, // instrument (falls back to pair) so non-forex journals read right (cyclus 7)
    concept: t.trade_concept,
    entry: t.entry,
    outcome: t.outcome,
    resultaat: round2(t.resultaat_pct),
    evaluation: t.trade_evaluation,
    missed,
  };
}

/** Cumulative resultaat after each taken trade, chronological (for the equity sparkline). */
function equityCurve(taken: ClosedTrade[]): number[] {
  const sorted = sortChronological(taken);
  let running = 0;
  return sorted.map((t) => {
    running = round2(running + t.resultaat_pct);
    return running;
  });
}

function buildErrorLine(t: TFunction, taken: ClosedTrade[], missed: ClosedTrade[], unit: ResultUnit): string | null {
  const { emotional, technical, missedCount, missedResultaat } = computeErrorCounts(taken, missed);
  const parts: string[] = [];
  if (emotional > 0) parts.push(t("reviewErrorStats.emotional", { count: emotional }));
  if (technical > 0) parts.push(t("reviewErrorStats.technical", { count: technical }));
  if (missedCount > 0) parts.push(t("reviewErrorStats.missed", { count: missedCount, pct: formatAggregate(missedResultaat, unit) }));
  return parts.length > 0 ? parts.join("   ·   ") : null;
}

function section(label: string, body: string | null, kind: ReviewSectionKind): ReviewPdfSection | null {
  const trimmed = body?.trim();
  return trimmed ? { label, body: trimmed, kind } : null;
}

const OVERZICHT_LABEL_KEY: Partial<Record<PeriodType, string>> = {
  quarter: "reviewContent.maandoverzicht",
  year: "reviewContent.kwartaaloverzicht",
};

function weeklySections(t: TFunction, r: WeeklyReview): ReviewPdfSection[] {
  // Neutral layout (Fase F): one mental section = mentaal_owner plus any legacy mentaal_trader.
  const mentaal = [r.mentaal_owner, r.mentaal_trader]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join("\n\n");
  return [
    section(t("reviewContent.verhalenNeutral"), r.verhalen, "text"),
    section(t("reviewContent.technisch"), r.technisch, "text"),
    section(t("reviewContent.mentaal"), mentaal || null, "voice"),
    section(t("reviewContent.takeaway"), r.takeaway, "takeaway"),
    section(t("reviewContent.overallComment"), r.overall_comment, "overall"),
  ].filter((s): s is ReviewPdfSection => s !== null);
}

function periodicSections(t: TFunction, r: PeriodicReview): ReviewPdfSection[] {
  const overzichtKey = OVERZICHT_LABEL_KEY[r.period_type];
  return [
    section(t("reviewContent.genomenTrades"), r.technisch, "text"),
    section(t("reviewContent.genomenTradesErrors"), r.mentaal_owner, "text"),
    section(t("reviewContent.gemisteTrades"), r.mentaal_trader, "text"),
    section(t("reviewContent.conclusie"), r.takeaway, "takeaway"),
    overzichtKey ? section(t(overzichtKey), r.periode_overzicht, "text") : null,
    section(t("reviewContent.overallComment"), r.overall_comment, "overall"),
  ].filter((s): s is ReviewPdfSection => s !== null);
}

function labels(t: TFunction): ReviewPdfLabels {
  return {
    tagline: t("reviewPdf.tagline"),
    generatedOn: t("reviewPdf.generatedOn"),
    resultHeading: t("reviews.resultHeading"),
    kpiTrades: t("reviews.trades"),
    kpiTotal: t("reviews.totalResult"),
    kpiAvgRR: t("reviews.avgRR"),
    winRate: t("journal.winRate"),
    cumulative: t("journal.cumulativeResult"),
    chartXTrades: t("reviewPdf.chartXTrades"),
    actiesLabel: "", // set by the caller (weekly = acties, periodic = werkpunten)
    takenHeading: t("reviews.tradesTaken"),
    missedHeading: t("reviews.missedTradesLabel"),
    noTrades: t("reviews.noTakenTrades"),
    colDate: t("reviewPdf.colDate"),
    colPair: t("reviewPdf.colPair"),
    colConcept: t("reviewPdf.colConcept"),
    colEntry: t("reviewPdf.colEntry"),
    colOutcome: t("reviewPdf.colOutcome"),
    colResult: t("reviewPdf.colResult"),
    colEval: t("reviewPdf.colEval"),
    preparedFor: t("reviewPdf.preparedFor"),
  };
}

function formatDate(now: Date): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${now.getFullYear()}`;
}

/** Builds the full presentation-ready payload for one review's branded PDF. `locale` (BCP47, from dateLocale(i18n.language)) localizes the period heading. */
export function buildReviewPdfData(t: TFunction, input: ReviewPdfInput, now: Date = new Date(), locale = "en-GB"): ReviewPdfData {
  // Eenheid-conversie aan de bron (Fase J): daarna staat álles hieronder (KPI's,
  // equity-sparkline, traderijen, error-regel) automatisch in de gekozen eenheid.
  // Currency zonder saldo valt eerlijk terug op % — zelfde regel als de provider.
  const preferred = input.resultUnit ?? "percent";
  const resultUnit: ResultUnit = preferred === "currency" && input.saldo == null ? "percent" : preferred;
  const taken = tradesInResultUnit(input.taken, resultUnit, input.saldo);
  const missed = tradesInResultUnit(input.missed, resultUnit, input.saldo);
  const kpis = computeOverviewKpis(taken);
  const decisive = kpis.wins + kpis.losses;
  const avgRR = decisive > 0 ? round2(kpis.totalResultaat / decisive) : 0;

  const heading =
    input.kind === "weekly"
      ? `W${input.review.week_nummer} · ${input.review.jaar}`
      : periodLabel(input.review.period_type, input.review.jaar, input.review.periode_nummer, locale);

  const sections =
    input.kind === "weekly" ? weeklySections(t, input.review) : periodicSections(t, input.review);
  const actiesLabel = input.kind === "weekly" ? t("reviewContent.acties") : t("reviewContent.werkpunten");

  const l = labels(t);
  l.actiesLabel = actiesLabel;

  return {
    heading,
    subtitle: input.review.titel,
    traderName: input.traderName?.trim() || null,
    generatedOn: formatDate(now),
    kpis: {
      trades: kpis.totalTrades,
      resultaat: kpis.totalResultaat,
      avgRR,
      wins: kpis.wins,
      be: kpis.be,
      losses: kpis.losses,
    },
    unit: resultUnit,
    equity: equityCurve(taken),
    errorLine: buildErrorLine(t, taken, missed, resultUnit),
    sections,
    acties: input.review.acties.map(parseActie),
    takenRows: sortChronological(taken).map((tr) => toRow(tr, false)),
    missedRows: sortChronological(missed).map((tr) => toRow(tr, true)),
    labels: l,
  };
}
