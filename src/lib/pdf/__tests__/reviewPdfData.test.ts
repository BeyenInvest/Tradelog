import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { buildReviewPdfData } from "../reviewPdfData";
import { makeTrade } from "@/lib/stats/__tests__/fixtures";
import type { PeriodicReview, WeeklyReview } from "@/lib/types";

// Passthrough translator: returns the key so tests assert on structure, not copy.
const t = ((key: string) => key) as unknown as TFunction;

const baseWeekly: WeeklyReview = {
  id: "wr-1",
  user_id: "user-1",
  methodology_id: null,
  week_nummer: 32,
  jaar: 2026,
  titel: "Geduldige week",
  verhalen: "CPI-cijfers dreven de dollar.",
  technisch: "  Nette setups afgewacht.  ",
  mentaal_owner: "Rustig gebleven.",
  mentaal_trader: "",
  acties: ["Backtesting: ok", "Journaling: niet ok", "Focus op A-setups"],
  takeaway: "Geduld loont.",
  overall_comment: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

describe("buildReviewPdfData", () => {
  it("computes KPIs and equity from taken trades only — missed never dilutes them", () => {
    const taken = [
      makeTrade({ datum_open: "2026-08-04", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ datum_open: "2026-08-05", outcome: "Loss", resultaat_pct: -1 }),
    ];
    const missed = [
      makeTrade({ datum_open: "2026-08-06", outcome: "Win", resultaat_pct: 5, trade_evaluation: "Missed trade" }),
    ];

    const data = buildReviewPdfData(t, { kind: "weekly", review: baseWeekly, taken, missed });

    expect(data.kpis.trades).toBe(2);
    expect(data.kpis.resultaat).toBe(1); // 2 + (-1), the +5 missed is excluded
    expect(data.kpis.wins).toBe(1);
    expect(data.kpis.losses).toBe(1);
    expect(data.kpis.avgRR).toBe(0.5); // 1 / 2 decisive
    expect(data.equity).toEqual([2, 1]); // cumulative over taken, no missed point
    expect(data.takenRows).toHaveLength(2);
    expect(data.missedRows).toHaveLength(1);
    expect(data.missedRows[0].missed).toBe(true);
  });

  it("uses weekly headings, labels and parses acties into a checklist", () => {
    const data = buildReviewPdfData(t, { kind: "weekly", review: baseWeekly, taken: [], missed: [] });

    expect(data.heading).toBe("W32 · 2026");
    expect(data.subtitle).toBe("Geduldige week");
    expect(data.labels.actiesLabel).toBe("reviewContent.acties");
    // Default (non-beta) keeps the WPM layout: separate mentaal voices, empty mentaal_trader dropped
    const labels = data.sections.map((s) => s.label);
    expect(labels).toContain("reviewContent.technisch");
    expect(labels).toContain("reviewContent.mentaalOwner");
    expect(labels).not.toContain("reviewContent.mentaalTrader");
    expect(labels).not.toContain("reviewContent.mentaal"); // neutral layout is beta-only
    expect(labels).toContain("reviewContent.verhalen");
    // verhalen is its own section, rendered above technisch
    expect(labels.indexOf("reviewContent.verhalen")).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf("reviewContent.verhalen")).toBeLessThan(labels.indexOf("reviewContent.technisch"));
    expect(data.sections.find((s) => s.label === "reviewContent.technisch")?.body).toBe("Nette setups afgewacht.");

    expect(data.acties).toEqual([
      { label: "Backtesting", status: "ok", value: null },
      { label: "Journaling", status: "niet-ok", value: null },
      { label: "Focus op A-setups", status: null, value: null },
    ]);
  });

  it("beta merges legacy mentaal_owner + mentaal_trader into one neutrally-labelled section", () => {
    const twoVoice: WeeklyReview = { ...baseWeekly, mentaal_owner: "Owner voice.", mentaal_trader: "Trader voice." };
    const data = buildReviewPdfData(t, { kind: "weekly", review: twoVoice, taken: [], missed: [], betaFeatures: true });
    const labels = data.sections.map((s) => s.label);
    // neutral narrative label + single merged mental block, no WPM voices
    expect(labels).toContain("reviewContent.verhalenNeutral");
    expect(labels).not.toContain("reviewContent.mentaalOwner");
    expect(labels).not.toContain("reviewContent.mentaalTrader");
    const mentaal = data.sections.find((s) => s.label === "reviewContent.mentaal");
    expect(mentaal?.body).toBe("Owner voice.\n\nTrader voice.");
    expect(mentaal?.kind).toBe("voice");
  });

  it("relabels sections for a periodic (monthly) review", () => {
    const periodic: PeriodicReview = {
      id: "pr-1",
      user_id: "user-1",
      methodology_id: null,
      period_type: "month",
      jaar: 2026,
      periode_nummer: 7,
      titel: null,
      technisch: "Genomen trades tekst.",
      mentaal_owner: "Errors tekst.",
      mentaal_trader: "Gemiste tekst.",
      acties: ["Werkpunt een"],
      takeaway: "Conclusie tekst.",
      overall_comment: "Slotwoord.",
      periode_overzicht: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };

    const data = buildReviewPdfData(t, { kind: "periodic", review: periodic, taken: [], missed: [] });

    expect(data.heading).toBe("July 2026"); // default locale en-GB
    // Locale param localizes the period heading (NL).
    const dataNl = buildReviewPdfData(t, { kind: "periodic", review: periodic, taken: [], missed: [] }, new Date(), "nl-BE");
    expect(dataNl.heading).toBe("juli 2026");
    expect(data.labels.actiesLabel).toBe("reviewContent.werkpunten");
    const labels = data.sections.map((s) => s.label);
    expect(labels).toEqual([
      "reviewContent.genomenTrades",
      "reviewContent.genomenTradesErrors",
      "reviewContent.gemisteTrades",
      "reviewContent.conclusie",
      "reviewContent.overallComment",
    ]);
  });

  it("formats generatedOn as dd-mm-yyyy", () => {
    const data = buildReviewPdfData(t, { kind: "weekly", review: baseWeekly, taken: [], missed: [] }, new Date(2026, 7, 7));
    expect(data.generatedOn).toBe("07-08-2026");
  });
});
