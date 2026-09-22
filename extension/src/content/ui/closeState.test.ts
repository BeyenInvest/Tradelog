// Unit-tests voor de pure laag van de sluit-sectie (F5b): welke trades er
// getoond worden, welke modus een trade krijgt, wat de request uit de
// formulier-waarden wordt en hoe een faalcode klinkt. De DOM-kant
// (closeSection.ts) is — net als de rest van het paneel — owner-getest in echte
// Chrome; hier staat alles wat zonder browser te bewijzen valt.
import { describe, expect, it } from "vitest";
import { GRADED_EVALUATIONS } from "../../../../src/lib/constants";
import type { LastBarInfo } from "../../adapter/parse";
import type { OpenTradeMatch } from "../../closeFlow";
import { setLang, t } from "../../i18nExt";
import {
  buildCloseRequest, closePreview, defaultMode, evaluationLabelKey, exitInputs, exitPriceAvailable,
  initialForm, mergeScreenshots, tradeSummary, tradesToShow, type CloseForm,
} from "./closeState";
import { closeTradeErrorCopy } from "./errors";

function trade(partial: Partial<OpenTradeMatch> = {}): OpenTradeMatch {
  return {
    id: "t1",
    datumOpen: "2026-09-15",
    tijdOpen: "09:30:00",
    pair: "AUDJPY",
    instrument: "AUDJPY",
    direction: "Long",
    entryPrice: 110.33,
    stopPrice: 109.83,
    targetPrice: 111.33,
    riskPct: 1,
    importRef: null,
    plannedRR: 2,
    ...partial,
  };
}

const BAR: LastBarInfo = { timeSec: 1789491600, close: 110.92, inReplay: false };

function form(partial: Partial<CloseForm> = {}): CloseForm {
  return { mode: "exit-price", exit: "", manualPct: "", manualDate: "", evaluation: "", mae: "", mfe: "", ...partial };
}

describe("tradesToShow", () => {
  it("toont de trades van een geslaagde lezing", () => {
    expect(tradesToShow({ ok: true, trades: [trade()] })).toHaveLength(1);
  });

  it("toont niets bij een fout of zonder lezing — de sectie verdwijnt dan", () => {
    expect(tradesToShow({ ok: false, stage: "profile", error: "profile-unreadable" })).toEqual([]);
    expect(tradesToShow(null)).toEqual([]);
  });
});

describe("modus-keuze", () => {
  it("kiest exit-prijs als de trade prijzen draagt én de chart een candle geeft", () => {
    expect(exitPriceAvailable(trade(), BAR)).toBe(true);
    expect(defaultMode(trade(), BAR)).toBe("exit-price");
    expect(initialForm(trade(), BAR).exit).toBe("110.92");
  });

  it("valt terug op handmatig als de chart geen laatste candle geeft", () => {
    expect(exitPriceAvailable(trade(), null)).toBe(false);
    expect(defaultMode(trade(), null)).toBe("manual");
    expect(initialForm(trade(), null).exit).toBe("");
  });

  it("valt terug op handmatig als de trade richting/entry/stop mist", () => {
    expect(exitInputs(trade({ direction: null }))).toBeNull();
    expect(exitInputs(trade({ stopPrice: null }))).toBeNull();
    expect(defaultMode(trade({ entryPrice: null }), BAR)).toBe("manual");
    // Mét alles erop en eraan blijft het risico optioneel (null = default in de app).
    expect(exitInputs(trade({ riskPct: null }))?.riskPct).toBeNull();
  });
});

describe("closePreview", () => {
  it("laat previewClose rekenen — het paneel zelf rekent niets", () => {
    // 110.33 → 110.92 met stop 109.83 = +1.18R; bij 1% risico is dat 1.18%.
    const live = closePreview(trade(), form({ exit: "110.92" }), BAR);
    expect(live).toEqual({ r: 1.18, resultaatPct: 1.18, outcome: "Win" });
  });

  it("leidt Loss en BE af uit het resultaat, nooit uit een keuze", () => {
    expect(closePreview(trade(), form({ exit: "109.83" }), BAR)?.outcome).toBe("Loss");
    expect(closePreview(trade(), form({ exit: "110.33" }), BAR)?.outcome).toBe("BE");
  });

  it("toont niets zonder bruikbare exit of in handmatige modus", () => {
    expect(closePreview(trade(), form({ exit: "" }), BAR)).toBeNull();
    expect(closePreview(trade(), form({ exit: "0" }), BAR)).toBeNull();
    expect(closePreview(trade(), form({ mode: "manual", manualPct: "2" }), BAR)).toBeNull();
  });
});

describe("buildCloseRequest — exit-prijs-pad", () => {
  it("bouwt een exit-request met de bar-tijd als sluitmoment", () => {
    const built = buildCloseRequest(trade(), form({ exit: "110.92", evaluation: "Good trade" }), BAR);
    expect(built).toEqual({
      ok: true,
      request: {
        tradeId: "t1",
        datumOpen: "2026-09-15",
        result: { kind: "exit-price", direction: "Long", entry: 110.33, stop: 109.83, exit: 110.92, riskPct: 1 },
        evaluation: "Good trade",
        maePct: null,
        mfePct: null,
        closeTimeUtcSec: BAR.timeSec,
        manualDate: null,
      },
    });
  });

  it("vraagt om een bruikbare exit-prijs", () => {
    expect(buildCloseRequest(trade(), form(), BAR)).toEqual({ ok: false, message: t("close.v.needExit") });
    expect(buildCloseRequest(trade(), form({ exit: "0" }), BAR)).toEqual({
      ok: false, message: t("close.v.exitPositive"),
    });
  });

  it("weigert een richting die de prijzen tegenspreekt in plaats van te gokken", () => {
    const built = buildCloseRequest(trade({ direction: "Short" }), form({ exit: "110.92" }), BAR);
    expect(built).toEqual({ ok: false, message: t("err.directionMismatch") });
  });

  it("stuurt de user naar handmatig als het exit-pad niet kan", () => {
    expect(buildCloseRequest(trade({ direction: null }), form({ exit: "110.92" }), BAR)).toEqual({
      ok: false, message: t("close.v.noExitPath"),
    });
    expect(buildCloseRequest(trade(), form({ exit: "110.92" }), null)).toEqual({
      ok: false, message: t("close.v.noBar"),
    });
  });
});

describe("buildCloseRequest — handmatig pad", () => {
  const manual = (partial: Partial<CloseForm> = {}) =>
    form({ mode: "manual", manualPct: "1.8", manualDate: "2026-09-17", ...partial });

  it("bouwt een handmatige request met een expliciete sluitdatum", () => {
    const built = buildCloseRequest(trade(), manual(), BAR);
    expect(built.ok && built.request.result).toEqual({ kind: "manual", resultaatPct: 1.8 });
    // Ook mét een chart-candle telt hier de datum die de user zelf koos.
    expect(built.ok && built.request.manualDate).toBe("2026-09-17");
    expect(built.ok && built.request.closeTimeUtcSec).toBeNull();
  });

  it("vraagt om een resultaat en een datum", () => {
    expect(buildCloseRequest(trade(), manual({ manualPct: "" }), null)).toEqual({
      ok: false, message: t("close.v.needResult"),
    });
    expect(buildCloseRequest(trade(), manual({ manualDate: "" }), null)).toEqual({
      ok: false, message: t("close.v.needDate"),
    });
  });

  it("houdt een sluitdatum vóór de opening tegen (server bewaakt 'm ook)", () => {
    const built = buildCloseRequest(trade(), manual({ manualDate: "2026-09-14" }), null);
    expect(built).toEqual({ ok: false, message: t("close.v.closeBeforeOpen", { date: "2026-09-15" }) });
  });
});

describe("buildCloseRequest — MAE/MFE", () => {
  it("neemt ingevulde excursies mee en laat lege leeg", () => {
    const built = buildCloseRequest(trade(), form({ exit: "110.92", mae: "0.4", mfe: "" }), BAR);
    expect(built.ok && [built.request.maePct, built.request.mfePct]).toEqual([0.4, null]);
  });

  it("weigert negatieve of onleesbare excursies (0049-checks)", () => {
    expect(buildCloseRequest(trade(), form({ exit: "110.92", mae: "-1" }), BAR)).toEqual({
      ok: false, message: t("close.v.excursion"),
    });
    expect(buildCloseRequest(trade(), form({ exit: "110.92", mfe: "abc" }), BAR)).toEqual({
      ok: false, message: t("close.v.excursion"),
    });
  });

  it("stuurt een lege evaluatie als null (en nooit 'Missed trade' — die staat niet in de lijst)", () => {
    const built = buildCloseRequest(trade(), form({ exit: "110.92" }), BAR);
    expect(built.ok && built.request.evaluation).toBeNull();
    expect(GRADED_EVALUATIONS).not.toContain("Missed trade");
  });
});

describe("tradeSummary", () => {
  it("zet één rij samen: wanneer, richting, entry→stop en plan-R", () => {
    expect(tradeSummary(trade())).toEqual({
      when: "2026-09-15 09:30",
      direction: "Long",
      range: "110.33 → 109.83",
      rr: "1 : 2",
    });
  });

  it("degradeert per veld in plaats van de rij te laten vallen", () => {
    expect(tradeSummary(trade({ tijdOpen: null, direction: null, entryPrice: null, plannedRR: null }))).toEqual({
      when: "2026-09-15",
      direction: "—",
      range: "—",
      rr: "—",
    });
  });
});

describe("evaluationLabelKey", () => {
  it("geeft elke graded evaluatie een ingevulde NL- én EN-zin", () => {
    for (const graded of GRADED_EVALUATIONS) {
      setLang("nl");
      const nl = t(evaluationLabelKey(graded));
      setLang("en");
      const en = t(evaluationLabelKey(graded));
      setLang("nl");
      expect(nl.length).toBeGreaterThan(0);
      // EN spiegelt de enum-waarde zelf (zoals het `enums`-namespace van de app).
      expect(en).toBe(graded);
    }
  });
});

describe("mergeScreenshots", () => {
  it("laat een nieuwe capture winnen en houdt de rest van de log staan", () => {
    expect(
      mergeScreenshots({ w: "u/w.png", d: "u/d.png", h4: null, h2: null }, { w: "u/w-new.png", d: null, h4: null, h2: null })
    ).toEqual({ w: "u/w-new.png", d: "u/d.png", h4: null, h2: null });
  });

  it("levert altijd de vier slots, ook zonder eerdere log", () => {
    expect(mergeScreenshots(null, {})).toEqual({ w: null, d: null, h4: null, h2: null });
  });
});

describe("closeTradeErrorCopy", () => {
  it("geeft elke faalcode van het sluitpad eigen copy", () => {
    expect(closeTradeErrorCopy({ ok: false, stage: "build", error: "missed-not-selectable" }).message).toContain(
      "Missed trade"
    );
    expect(closeTradeErrorCopy({ ok: false, stage: "build", error: "no-close-time" }).message).toContain("sluitdatum");
    expect(closeTradeErrorCopy({ ok: false, stage: "update", error: "not-found" }).message).toContain("niet meer open");
    // Gedeelde codes lopen via dezelfde zinnen als het logpad.
    expect(closeTradeErrorCopy({ ok: false, stage: "auth", error: "not-linked" }).message).toContain("popup");
    expect(closeTradeErrorCopy({ ok: false, stage: "update", error: "missing-column" }).message).toContain("0058");
  });

  it("degradeert netjes op een onbekende code", () => {
    const copy = closeTradeErrorCopy({ ok: false, stage: "update", error: "other", detail: "boem" });
    expect(copy.message).toBe("Sluiten is niet gelukt.");
    expect(copy.detail).toBe("boem");
  });

  it("volgt de taalkeuze van de extensie", () => {
    setLang("en");
    try {
      expect(closeTradeErrorCopy({ ok: false, stage: "build", error: "close-before-open" }).message).toBe(
        "The close date lies before the day the trade was opened."
      );
    } finally {
      setLang("nl");
    }
  });
});
