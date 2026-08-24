import type { TFunction } from "i18next";
import type { Outcome, ResultUnit } from "@/lib/constants";
import type { PeriodicReview, ReviewKind, WeeklyReview } from "@/lib/types";
import { computeOverviewKpis, computeErrorCounts, sortChronological, round2, type ClosedTrade } from "@/lib/stats";
import { formatAggregate, tradesInResultUnit } from "@/lib/format";
import { periodLabel } from "@/lib/periodRanges";
import { readSectionDisplayText, readSectionList, reviewSectionLabel, type ReviewSection } from "@/lib/reviewSections";

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
  /** This journal's resolved review sections (Fase N5) — drives the section list + acties label. */
  sections: ReviewSection[];
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

/** Map a resolved section's display style to the PDF's section kind (list is handled separately). */
function styleToKind(style: ReviewSection["style"]): ReviewSectionKind {
  switch (style) {
    case "voice":
      return "voice";
    case "takeaway":
      return "takeaway";
    case "overall":
      return "overall";
    default:
      return "text";
  }
}

/**
 * Build the PDF's prose sections from the journal's resolved sections (Fase N5).
 * The built-in `acties` list is rendered separately as the checklist block
 * (data.acties); any other list section becomes a bulleted text block. Empty
 * sections are dropped. Reproduces the pre-N5 weekly/periodic order when the
 * journal uses the defaults.
 */
function buildPdfSections(t: TFunction, kind: ReviewKind, review: WeeklyReview | PeriodicReview, sections: ReviewSection[]): ReviewPdfSection[] {
  const out: ReviewPdfSection[] = [];
  for (const s of sections) {
    const label = reviewSectionLabel(t, s);
    if (s.inputType === "list") {
      if (s.builtin && s.key === "acties") continue; // rendered as the checklist block
      const items = readSectionList(review, s).map((i) => i.trim()).filter(Boolean);
      if (items.length) out.push({ label, body: items.map((i) => `• ${i}`).join("\n"), kind: "text" });
      continue;
    }
    const body = readSectionDisplayText(kind, review, s).trim();
    if (body) out.push({ label, body, kind: styleToKind(s.style) });
  }
  return out;
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

  const sections = buildPdfSections(t, input.kind, input.review, input.sections);
  // The action-items checklist follows the journal's `acties` list section: its
  // label, and whether it appears at all (a journal can remove it). Its default
  // label is Acties (weekly) / Werkpunten (periodic).
  const actiesSection = input.sections.find((s) => s.inputType === "list" && s.builtin && s.key === "acties");
  const actiesLabel = actiesSection
    ? reviewSectionLabel(t, actiesSection)
    : t(input.kind === "weekly" ? "reviewContent.acties" : "reviewContent.werkpunten");
  const acties = actiesSection ? input.review.acties.map(parseActie) : [];

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
    acties,
    takenRows: sortChronological(taken).map((tr) => toRow(tr, false)),
    missedRows: sortChronological(missed).map((tr) => toRow(tr, true)),
    labels: l,
  };
}
