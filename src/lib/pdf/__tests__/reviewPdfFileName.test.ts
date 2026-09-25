import { describe, it, expect } from "vitest";
import { reviewPdfFileName } from "../generateReviewPdf";

describe("reviewPdfFileName", () => {
  it("naam van de trader gevolgd door de titel van de review", () => {
    expect(reviewPdfFileName({ traderName: "Beyen Chesney", subtitle: "Geduldige week", heading: "W38 · 2026" })).toBe(
      "Beyen Chesney - Geduldige week.pdf"
    );
  });

  it("zonder titel valt terug op de periode-kop", () => {
    expect(reviewPdfFileName({ traderName: "Beyen", subtitle: null, heading: "W38 · 2026" })).toBe("Beyen - Week 38 2026.pdf");
    expect(reviewPdfFileName({ traderName: "Beyen", subtitle: "   ", heading: "W38 · 2026" })).toBe("Beyen - Week 38 2026.pdf");
  });

  it("periodieke kop zonder middenpunt", () => {
    expect(reviewPdfFileName({ traderName: "Beyen", subtitle: null, heading: "Q3 · 2026" })).toBe("Beyen - Q3 2026.pdf");
    expect(reviewPdfFileName({ traderName: "Beyen", subtitle: null, heading: "september 2026" })).toBe("Beyen - september 2026.pdf");
  });

  it("zonder naam alleen de titel", () => {
    expect(reviewPdfFileName({ traderName: null, subtitle: "Geduldige week", heading: "W38 · 2026" })).toBe("Geduldige week.pdf");
  });

  it("verwijdert tekens die geen OS in een bestandsnaam toelaat, accenten blijven", () => {
    expect(reviewPdfFileName({ traderName: "Zoë", subtitle: 'EUR/USD: "top" week?...', heading: "x" })).toBe(
      "Zoë - EUR USD top week.pdf"
    );
  });

  it("valt nooit terug op een lege naam", () => {
    expect(reviewPdfFileName({ traderName: null, subtitle: null, heading: "" })).toBe("Beyen review.pdf");
  });
});
