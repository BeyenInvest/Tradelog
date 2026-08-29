import type { TFunction } from "i18next";
import type { Outcome, ResultUnit } from "@/lib/constants";
import type { PeriodicReview, ReviewKind, Trade, WeeklyReview } from "@/lib/types";
import { computeOverviewKpis, computeErrorCounts, sortChronological, closedTrades, isOpen, round2, type ClosedTrade } from "@/lib/stats";
import { groupTradesByOutcome } from "@/lib/tradeGrouping";
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

export type ReviewSectionKind = "text" | "voice" | "takeaway" | "overall" | "acties";

export interface ReviewPdfSection {
  label: string;
  body: string;
  kind: ReviewSectionKind;
  /** Only for kind === "acties": the parsed checklist items, rendered inline at this section's configured position. */
  acties?: ReviewPdfActie[];
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
  /** Null for a still-running open trade (no outcome yet). */
  outcome: Outcome | null;
  /** Null for an open trade — no realized result. */
  resultaat: number | null;
  evaluation: string | null;
  missed: boolean;
  /** Still-running trade (is_open) — shown in the list but excluded from every stat. */
  open: boolean;
}

export interface ReviewPdfTradeGroup {
  /** Outcome bucket label — "Win" / "BE" / "Loss", exactly like the on-screen groups. */
  label: string;
  count: number;
  /** Real cumulative result for this bucket, in `unit`. Null for missed groups (hypothetical — no real total). */
  subtotal: number | null;
  rows: ReviewPdfTradeRow[];
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
  /** Outcome-cell text for a still-running open trade (on-screen "loopt" badge). */
  openBadge: string;
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
  /** Taken trades grouped by outcome (Win/BE/Loss), matching the on-screen default view. Empty buckets omitted. */
  takenGroups: ReviewPdfTradeGroup[];
  /** Missed trades grouped by outcome — hypothetical, so no per-group subtotal. Empty buckets omitted. */
  missedGroups: ReviewPdfTradeGroup[];
  labels: ReviewPdfLabels;
}

export type ReviewPdfInput = (
  | {
      kind: "weekly";
      // Full taken list incl. still-running open trades — stats use only the closed
      // subset (computed here), but the trade list shows the open ones too, like on-screen.
      review: WeeklyReview;
      taken: Trade[];
      missed: ClosedTrade[];
    }
  | { kind: "periodic"; review: PeriodicReview; taken: Trade[]; missed: ClosedTrade[] }
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

function toRow(t: Trade, missed: boolean): ReviewPdfTradeRow {
  const open = isOpen(t);
  return {
    datum: t.datum_open,
    pair: t.instrument ?? t.pair, // instrument (falls back to pair) so non-forex journals read right (cyclus 7)
    concept: t.trade_concept,
    entry: t.entry,
    outcome: open ? null : t.outcome,
    resultaat: open || t.resultaat_pct == null ? null : round2(t.resultaat_pct),
    evaluation: t.trade_evaluation,
    missed,
    open,
  };
}

/**
 * Group trades into the on-screen default Win/BE/Loss buckets (empty buckets
 * dropped), each with its rows in chronological order — so the PDF matches the
 * grouped default view every on-screen review shows, instead of one flat table.
 * Taken buckets carry a real subtotal; missed buckets don't (hypothetical).
 */
function toTradeGroups(trades: Trade[], missed: boolean): ReviewPdfTradeGroup[] {
  return groupTradesByOutcome(trades)
    .filter((g) => g.trades.length > 0)
    .map((g) => ({
      label: g.label,
      count: g.trades.length,
      // Missed (hypothetical) and Open (no realized result yet) buckets carry no real total.
      subtotal: missed || g.key === "Open" ? null : g.resultaatTotal,
      rows: sortChronological(g.trades).map((tr) => toRow(tr, missed)),
    }));
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
 * Build the PDF's content sections from the journal's resolved sections (Fase N5).
 * The built-in `acties` list is emitted as a dedicated checklist node *at its
 * configured position* (so the PDF matches the on-screen section order instead
 * of forcing the checklist to the end); any other list section becomes a
 * bulleted text block. Empty sections are dropped. Reproduces the pre-N5
 * weekly/periodic order when the journal uses the defaults.
 */
function buildPdfSections(t: TFunction, kind: ReviewKind, review: WeeklyReview | PeriodicReview, sections: ReviewSection[]): ReviewPdfSection[] {
  const out: ReviewPdfSection[] = [];
  for (const s of sections) {
    const label = reviewSectionLabel(t, s);
    if (s.inputType === "list") {
      const items = readSectionList(review, s).map((i) => i.trim()).filter(Boolean);
      if (!items.length) continue;
      if (s.builtin && s.key === "acties") {
        out.push({ label, body: "", kind: "acties", acties: items.map(parseActie) });
      } else {
        out.push({ label, body: items.map((i) => `• ${i}`).join("\n"), kind: "text" });
      }
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
    openBadge: t("tradeBadge.open"),
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
  // Open trades have no realized result — kept for the trade list only, never for
  // stats/equity/error-line (same rule as isMissed). Convert only the closed ones.
  const takenClosed = tradesInResultUnit(closedTrades(input.taken), resultUnit, input.saldo);
  const takenOpen = input.taken.filter(isOpen);
  const missed = tradesInResultUnit(input.missed, resultUnit, input.saldo);
  const kpis = computeOverviewKpis(takenClosed);
  // Gem. resultaat/trade deelt door álle genomen trades (een BE-trade is een echte
  // genomen trade met 0% en hoort in de noemer) — zo spreken de "trades"-kaart en
  // het gemiddelde elkaar niet tegen. Spiegelt ReviewStatsHeader op het scherm.
  const avgRR = kpis.totalTrades > 0 ? round2(kpis.totalResultaat / kpis.totalTrades) : 0;

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
    equity: equityCurve(takenClosed),
    errorLine: buildErrorLine(t, takenClosed, missed, resultUnit),
    sections,
    acties,
    // Open trades join the taken table (as their own "Open" bucket via
    // groupTradesByOutcome), so a still-running trade shows up like it does on-screen.
    takenGroups: toTradeGroups([...takenClosed, ...takenOpen], false),
    missedGroups: toTradeGroups(missed, true),
    labels: l,
  };
}
