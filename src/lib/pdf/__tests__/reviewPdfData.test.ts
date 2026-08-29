import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { buildReviewPdfData } from "../reviewPdfData";
import { defaultReviewSections } from "@/lib/reviewSections";
import { makeTrade } from "@/lib/stats/__tests__/fixtures";
import type { PeriodicReview, WeeklyReview } from "@/lib/types";

// Passthrough translator: returns the key so tests assert on structure, not copy.
const t = ((key: string) => key) as unknown as TFunction;

// Built-in default section sets — the journal-configurable input the PDF adapter now takes.
const wSec = defaultReviewSections("weekly");
const pSec = defaultReviewSections("periodic", "month");

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
  content: {},
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

    const data = buildReviewPdfData(t, { kind: "weekly", sections: wSec, review: baseWeekly, taken, missed });

    expect(data.kpis.trades).toBe(2);
    expect(data.kpis.resultaat).toBe(1); // 2 + (-1), the +5 missed is excluded
    expect(data.kpis.wins).toBe(1);
    expect(data.kpis.losses).toBe(1);
    expect(data.kpis.avgRR).toBe(0.5); // 1 / 2 trades
    expect(data.equity).toEqual([2, 1]); // cumulative over taken, no missed point
    // Trades are grouped by outcome (the on-screen default): Win + Loss buckets, empty BE dropped.
    expect(data.takenGroups.map((g) => g.label)).toEqual(["Win", "Loss"]);
    expect(data.takenGroups.find((g) => g.label === "Win")).toMatchObject({ count: 1, subtotal: 2 });
    expect(data.takenGroups.find((g) => g.label === "Loss")).toMatchObject({ count: 1, subtotal: -1 });
    // Missed trades group too, but are hypothetical → no per-group subtotal.
    expect(data.missedGroups).toHaveLength(1);
    expect(data.missedGroups[0].subtotal).toBeNull();
    expect(data.missedGroups[0].rows[0].missed).toBe(true);
  });

  it("uses weekly headings, labels and parses acties into a checklist", () => {
    const data = buildReviewPdfData(t, { kind: "weekly", sections: wSec, review: baseWeekly, taken: [], missed: [] });

    expect(data.heading).toBe("W32 · 2026");
    expect(data.subtitle).toBe("Geduldige week");
    expect(data.labels.actiesLabel).toBe("reviewContent.acties");
    // Fase F: weekly is always the neutral layout — neutral narrative label + one merged
    // mental section, never the retired two-voice WPM labels.
    const labels = data.sections.map((s) => s.label);
    expect(labels).toContain("reviewContent.technisch");
    expect(labels).toContain("reviewContent.mentaal");
    expect(labels).not.toContain("reviewContent.mentaalOwner");
    expect(labels).not.toContain("reviewContent.mentaalTrader");
    expect(labels).toContain("reviewContent.verhalenNeutral");
    // the narrative is its own section, rendered above technisch
    expect(labels.indexOf("reviewContent.verhalenNeutral")).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf("reviewContent.verhalenNeutral")).toBeLessThan(labels.indexOf("reviewContent.technisch"));
    expect(data.sections.find((s) => s.label === "reviewContent.technisch")?.body).toBe("Nette setups afgewacht.");

    expect(data.acties).toEqual([
      { label: "Backtesting", status: "ok", value: null },
      { label: "Journaling", status: "niet-ok", value: null },
      { label: "Focus op A-setups", status: null, value: null },
    ]);
  });

  it("merges legacy mentaal_owner + mentaal_trader into one neutrally-labelled section", () => {
    const twoVoice: WeeklyReview = { ...baseWeekly, mentaal_owner: "Owner voice.", mentaal_trader: "Trader voice." };
    const data = buildReviewPdfData(t, { kind: "weekly", sections: wSec, review: twoVoice, taken: [], missed: [] });
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
      content: {},
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    };

    const data = buildReviewPdfData(t, { kind: "periodic", sections: pSec, review: periodic, taken: [], missed: [] });

    expect(data.heading).toBe("July 2026"); // default locale en-GB
    // Locale param localizes the period heading (NL).
    const dataNl = buildReviewPdfData(t, { kind: "periodic", sections: pSec, review: periodic, taken: [], missed: [] }, new Date(), "nl-BE");
    expect(dataNl.heading).toBe("juli 2026");
    expect(data.labels.actiesLabel).toBe("reviewContent.werkpunten");
    const labels = data.sections.map((s) => s.label);
    // The werkpunten checklist now renders inline at its configured position
    // (before the conclusie), matching the on-screen section order.
    expect(labels).toEqual([
      "reviewContent.genomenTrades",
      "reviewContent.genomenTradesErrors",
      "reviewContent.gemisteTrades",
      "reviewContent.werkpunten",
      "reviewContent.conclusie",
      "reviewContent.overallComment",
    ]);
    const werkpunten = data.sections.find((s) => s.label === "reviewContent.werkpunten");
    expect(werkpunten?.kind).toBe("acties");
    expect(werkpunten?.acties).toEqual([{ label: "Werkpunt een", status: null, value: null }]);
  });

  it("includes open trades in the trade list but never in the stats", () => {
    const taken = [
      makeTrade({ datum_open: "2026-08-04", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ datum_open: "2026-08-10", is_open: true }), // still running, no realized result
    ];
    const data = buildReviewPdfData(t, { kind: "weekly", sections: wSec, review: baseWeekly, taken, missed: [] });

    // Stats + equity see only the one closed trade.
    expect(data.kpis.trades).toBe(1);
    expect(data.kpis.resultaat).toBe(2);
    expect(data.equity).toEqual([2]);

    // But the open trade still shows in the taken table, in its own leading "Open" bucket, without a subtotal.
    expect(data.takenGroups[0].label).toBe("Open");
    const openGroup = data.takenGroups[0];
    expect(openGroup.subtotal).toBeNull();
    expect(openGroup.count).toBe(1);
    expect(openGroup.rows[0]).toMatchObject({ open: true, outcome: null, resultaat: null });
  });

  it("formats generatedOn as dd-mm-yyyy", () => {
    const data = buildReviewPdfData(t, { kind: "weekly", sections: wSec, review: baseWeekly, taken: [], missed: [] }, new Date(2026, 7, 7));
    expect(data.generatedOn).toBe("07-08-2026");
  });
});
