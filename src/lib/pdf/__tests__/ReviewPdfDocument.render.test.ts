// @vitest-environment node
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import type { TFunction } from "i18next";
import { renderToBuffer, Font } from "@react-pdf/renderer";
import { buildReviewPdfData } from "../reviewPdfData";
import { ReviewPdfDocument } from "../ReviewPdfDocument";
import { makeTrade } from "@/lib/stats/__tests__/fixtures";
import type { WeeklyReview } from "@/lib/types";

const t = ((k: string) => k) as unknown as TFunction;

// The Vite asset-URL registration (registerPdfFonts) can't resolve under Node,
// so register the bundled TTFs by absolute path — same family the document uses.
Font.register({
  family: "InstrumentSerif",
  fonts: [
    { src: resolve("src/assets/fonts/InstrumentSerif-Regular.ttf"), fontStyle: "normal" },
    { src: resolve("src/assets/fonts/InstrumentSerif-Italic.ttf"), fontStyle: "italic" },
  ],
});

describe("ReviewPdfDocument render smoke", () => {
  it("renders a valid PDF without throwing", async () => {
    const review: WeeklyReview = {
      id: "wr", user_id: "u", methodology_id: null, week_nummer: 32, jaar: 2026, titel: "Test",
      verhalen: "Narratief", technisch: "Tekst", mentaal_owner: "Owner voice", mentaal_trader: "Trader voice",
      acties: ["Backtesting: ok", "Journaling: niet ok", "Doel: sneller"],
      takeaway: "Geduld loont", overall_comment: "Slot",
      created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    };
    const taken = [
      makeTrade({ datum_open: "2026-08-04", outcome: "Win", resultaat_pct: 2 }),
      makeTrade({ datum_open: "2026-08-05", outcome: "Loss", resultaat_pct: -1 }),
      makeTrade({ datum_open: "2026-08-06", outcome: "BE", resultaat_pct: 0 }),
    ];
    const missed = [makeTrade({ datum_open: "2026-08-07", resultaat_pct: 3, trade_evaluation: "Missed trade" })];

    const data = buildReviewPdfData(t, { kind: "weekly", review, taken, missed });
    const el = createElement(ReviewPdfDocument, { data }) as unknown as Parameters<typeof renderToBuffer>[0];
    const buf = await renderToBuffer(el);

    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
