import { describe, it, expect } from "vitest";
import {
  defaultReviewSections,
  resolveReviewSections,
  reviewSectionLabel,
  readSectionText,
  readSectionList,
  readSectionDisplayText,
  initialReviewValues,
  buildWeeklyReviewContent,
  buildPeriodicReviewContent,
  slugifySectionKey,
  type ReviewSection,
} from "@/lib/reviewSections";
import type { ReviewSectionRow, WeeklyReview } from "@/lib/types";

// A trivial t() standing in for i18next: every key "resolves" to itself, so a
// built-in section shows its key and a defaultValue never leaks through.
const t = ((key: string) => key) as never;

function weekly(over: Partial<WeeklyReview> = {}): WeeklyReview {
  return {
    id: "w1", user_id: "u", methodology_id: "m", week_nummer: 1, jaar: 2026, titel: null,
    verhalen: null, technisch: null, mentaal_owner: null, mentaal_trader: null,
    acties: [], takeaway: null, overall_comment: null, content: {},
    created_at: "", updated_at: "", ...over,
  };
}

describe("defaultReviewSections", () => {
  it("weekly matches the pre-N5 hardcoded set, in order, all built-in", () => {
    const s = defaultReviewSections("weekly");
    expect(s.map((x) => x.key)).toEqual(["verhalen", "technisch", "mentaal_owner", "acties", "takeaway", "overall_comment"]);
    expect(s.every((x) => x.builtin)).toBe(true);
    expect(s.find((x) => x.key === "acties")?.inputType).toBe("list");
    expect(s.find((x) => x.key === "mentaal_owner")?.style).toBe("voice");
    expect(s.find((x) => x.key === "takeaway")?.style).toBe("takeaway");
  });

  it("periodic month: reflectie-secties in, periode_overzicht + overall_comment out", () => {
    const s = defaultReviewSections("periodic", "month");
    expect(s.map((x) => x.key)).toEqual([
      "technisch",
      "mentaal_owner",
      "mentaal_trader",
      "wat_werkte",
      "wat_werkte_niet",
      "acties",
      "takeaway",
    ]);
    // The two reflectie-secties are content-bag sections, not backed by a column.
    expect(s.find((x) => x.key === "wat_werkte")?.builtin).toBe(false);
    expect(s.find((x) => x.key === "wat_werkte_niet")?.builtin).toBe(false);
  });

  it("periodic quarter/year carry the reflectie-secties and keep overall_comment", () => {
    for (const p of ["quarter", "year"] as const) {
      const keys = defaultReviewSections("periodic", p).map((x) => x.key);
      expect(keys).toContain("overall_comment");
      expect(keys).toContain("wat_werkte");
      expect(keys).toContain("wat_werkte_niet");
      // Reflectie-secties komen na de gemiste-trades-sectie, vóór de werkpunten.
      expect(keys.indexOf("wat_werkte")).toBeGreaterThan(keys.indexOf("mentaal_trader"));
      expect(keys.indexOf("wat_werkte_niet")).toBeLessThan(keys.indexOf("acties"));
    }
  });

  it("periodic includes periode_overzicht for quarter/year with a period-specific label", () => {
    const q = defaultReviewSections("periodic", "quarter").find((x) => x.key === "periode_overzicht");
    expect(q?.labelKey).toBe("reviewContent.maandoverzicht");
    const y = defaultReviewSections("periodic", "year").find((x) => x.key === "periode_overzicht");
    expect(y?.labelKey).toBe("reviewContent.kwartaaloverzicht");
  });
});

describe("resolveReviewSections", () => {
  const rows: ReviewSectionRow[] = [
    { id: "1", methodology_id: "m", review_kind: "weekly", section_key: "killzone", label: "Killzone", label_key: null, input_type: "text", sort_order: 2 },
    { id: "2", methodology_id: "m", review_kind: "weekly", section_key: "technisch", label: "Tech", label_key: null, input_type: "text", sort_order: 1 },
    { id: "3", methodology_id: "m", review_kind: "periodic", section_key: "x", label: "X", label_key: null, input_type: "list", sort_order: 1 },
  ];

  it("falls back to defaults when there are no rows for the kind", () => {
    expect(resolveReviewSections("weekly", []).map((s) => s.key)).toEqual(defaultReviewSections("weekly").map((s) => s.key));
    expect(resolveReviewSections("weekly", rows.filter((r) => r.review_kind === "periodic")).length).toBe(defaultReviewSections("weekly").length);
  });

  it("uses own rows sorted by sort_order, tagging built-in vs custom", () => {
    const s = resolveReviewSections("weekly", rows);
    expect(s.map((x) => x.key)).toEqual(["technisch", "killzone"]);
    expect(s.find((x) => x.key === "technisch")?.builtin).toBe(true);
    const kz = s.find((x) => x.key === "killzone");
    expect(kz?.builtin).toBe(false);
    expect(kz?.label).toBe("Killzone");
    expect(kz?.style).toBe("text");
  });

  it("derives a custom list section's style from its input type", () => {
    const s = resolveReviewSections("periodic", rows);
    expect(s).toHaveLength(1);
    expect(s[0].style).toBe("list");
    expect(s[0].builtin).toBe(false);
  });
});

describe("reviewSectionLabel", () => {
  it("translates the built-in key, but a custom section's own text wins", () => {
    expect(reviewSectionLabel(t, { label: "", labelKey: "reviewContent.technisch" })).toBe("reviewContent.technisch");
    expect(reviewSectionLabel(t, { label: "My section", labelKey: null })).toBe("My section");
  });
});

describe("value read/write", () => {
  const custom: ReviewSection = { key: "killzone", label: "Killzone", labelKey: null, inputType: "text", style: "text", rows: 3, builtin: false };
  const customList: ReviewSection = { key: "checks", label: "Checks", labelKey: null, inputType: "list", style: "list", rows: 1, builtin: false };
  const technisch = defaultReviewSections("weekly").find((s) => s.key === "technisch")!;
  const acties = defaultReviewSections("weekly").find((s) => s.key === "acties")!;

  it("reads built-in columns and custom content", () => {
    const r = weekly({ technisch: "col", acties: ["a", "b"], content: { killzone: "bag", checks: ["c"] } });
    expect(readSectionText(r, technisch)).toBe("col");
    expect(readSectionText(r, custom)).toBe("bag");
    expect(readSectionList(r, acties)).toEqual(["a", "b"]);
    expect(readSectionList(r, customList)).toEqual(["c"]);
  });

  it("merges legacy mentaal_trader into the weekly mentaal block on display only", () => {
    const r = weekly({ mentaal_owner: "own", mentaal_trader: "trade" });
    const mentaal = defaultReviewSections("weekly").find((s) => s.key === "mentaal_owner")!;
    expect(readSectionText(r, mentaal)).toBe("own");
    expect(readSectionDisplayText("weekly", r, mentaal)).toBe("own\n\ntrade");
  });

  it("seeds initial form values, one empty row for empty lists", () => {
    const vals = initialReviewValues([technisch, acties, customList], weekly({ technisch: "x" }));
    expect(vals.technisch).toBe("x");
    expect(vals.acties).toEqual([""]);
    expect(vals.checks).toEqual([""]);
  });
});

describe("buildWeeklyReviewContent", () => {
  const sections = resolveReviewSections("weekly", [
    { id: "1", methodology_id: "m", review_kind: "weekly", section_key: "technisch", label: "Tech", label_key: null, input_type: "text", sort_order: 1 },
    { id: "2", methodology_id: "m", review_kind: "weekly", section_key: "killzone", label: "Killzone", label_key: null, input_type: "text", sort_order: 2 },
    { id: "3", methodology_id: "m", review_kind: "weekly", section_key: "checks", label: "Checks", label_key: null, input_type: "list", sort_order: 3 },
  ]);

  it("splits values across columns and the content bag, trimming empty list rows", () => {
    const out = buildWeeklyReviewContent(sections, { technisch: "t", killzone: "kz", checks: ["a", "  ", "b"] });
    expect(out.technisch).toBe("t");
    expect(out.content).toEqual({ killzone: "kz", checks: ["a", "b"] });
    expect(out.verhalen).toBeNull();
    expect(out.acties).toEqual([]);
  });

  it("preserves hidden built-in columns and content keys from the existing review", () => {
    const existing = weekly({ verhalen: "keep", mentaal_trader: "legacy", content: { old: "x" } });
    const out = buildWeeklyReviewContent(sections, { technisch: "t", killzone: "", checks: [] }, existing);
    expect(out.verhalen).toBe("keep"); // not a visible section → untouched
    expect(out.mentaal_trader).toBe("legacy");
    expect(out.content.old).toBe("x"); // hidden custom section preserved
    expect(out.content.killzone).toBeUndefined(); // empty custom text dropped
  });
});

describe("buildPeriodicReviewContent", () => {
  it("writes the built-in periodic columns from the default set", () => {
    const sections = defaultReviewSections("periodic", "quarter");
    const out = buildPeriodicReviewContent(sections, {
      technisch: "gt", mentaal_owner: "err", mentaal_trader: "missed", acties: ["w1"],
      takeaway: "concl", periode_overzicht: "ov", overall_comment: "oc",
    });
    expect(out.technisch).toBe("gt");
    expect(out.mentaal_trader).toBe("missed");
    expect(out.periode_overzicht).toBe("ov");
    expect(out.acties).toEqual(["w1"]);
    expect(out.content).toEqual({});
  });
});

describe("slugifySectionKey", () => {
  it("lowercases, underscores and strips", () => {
    expect(slugifySectionKey("Killzone discipline")).toBe("killzone_discipline");
    expect(slugifySectionKey("HTF bias?")).toBe("htf_bias");
    expect(slugifySectionKey("!!!")).toBe("sectie");
  });
});
