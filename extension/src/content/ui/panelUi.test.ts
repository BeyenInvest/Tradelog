// Unit-tests voor de pure paneel-laag (F2d): formattering, foutcopy en de
// beslisregels van de dynamische form. De DOM-kant (form.ts/panelApp.ts) wordt
// hier bewust niet getest — die is handmatig owner-getest in echte Chrome.
import { describe, expect, it } from "vitest";
import type { JournalField } from "../../db";
import { setLang } from "../../i18nExt";
import { humanizeSchemaDetail, logTradeErrorCopy } from "./errors";
import { slotStatus } from "./snapshotState";
import {
  customFromValues, faseValue, formFields, groupFields, isVisible, missingRequired,
} from "./fields";
import { formatPrice, formatRR, formatResolution } from "./format";

function field(partial: Partial<JournalField> & { fieldKey: string }): JournalField {
  return {
    id: partial.fieldKey,
    label: partial.fieldKey,
    labelKey: null,
    fieldType: "text",
    options: null,
    required: false,
    isComputed: false,
    groupLabel: null,
    sortOrder: 0,
    showWhenFieldId: null,
    showWhenValues: null,
    ...partial,
  };
}

describe("formatResolution", () => {
  it("vertaalt TV-resoluties naar trader-notatie", () => {
    expect(formatResolution("240")).toBe("4H");
    expect(formatResolution("60")).toBe("1H");
    expect(formatResolution("15")).toBe("15m");
    expect(formatResolution("D")).toBe("D");
    expect(formatResolution("W")).toBe("W");
    expect(formatResolution("30S")).toBe("30s");
    expect(formatResolution("1440")).toBe("1D");
  });

  it("laat onbekende vormen staan in plaats van te gokken", () => {
    expect(formatResolution("3M")).toBe("3M");
    expect(formatResolution("")).toBe("—");
  });
});

describe("formatPrice / formatRR", () => {
  it("toont prijzen zonder nul-staart en met puntdecimaal", () => {
    expect(formatPrice(1.23456)).toBe("1.23456");
    expect(formatPrice(158.5)).toBe("158.5");
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(Number.NaN)).toBe("—");
  });

  it("schrijft R:R zoals de app", () => {
    expect(formatRR(2.4)).toBe("1 : 2.4");
    expect(formatRR(null)).toBe("—");
  });
});

describe("formFields", () => {
  const legacy = [
    field({ fieldKey: "fase", options: ["Fase 2", "Fase 1"] }),
    field({ fieldKey: "structuur", sortOrder: 2 }),
    field({ fieldKey: "eigen_veld", sortOrder: 1 }),
    field({ fieldKey: "berekend", sortOrder: 3, isComputed: true }),
  ];

  it("laat fase, computed en legacy-WPM-kenmerken weg op een legacy journal", () => {
    // `structuur` valt weg omdat het paneel 'm als fase-kenmerk rendert
    // (fase2_structuur/fase3_structuur), niet als custom veld.
    expect(formFields(legacy).map((f) => f.fieldKey)).toEqual(["eigen_veld"]);
  });

  it("houdt dezelfde sleutel wél op een niet-legacy journal", () => {
    const modern = [field({ fieldKey: "structuur" }), field({ fieldKey: "notitie", sortOrder: 1 })];
    expect(formFields(modern).map((f) => f.fieldKey)).toEqual(["structuur", "notitie"]);
    expect(isLegacyJournal(modern)).toBe(false);
  });

  it("gebruikt de eerste fase-optie als fase-waarde (zoals tradeFlow.firstFaseOf)", () => {
    expect(faseValue(legacy)).toBe("Fase 2");
    expect(faseValue([])).toBe("Fase 1");
  });
});

describe("isVisible (show_when)", () => {
  const parent = field({ fieldKey: "setup", id: "p1", fieldType: "enum", options: ["A", "B"] });
  const child = field({ fieldKey: "detail", showWhenFieldId: "p1", showWhenValues: ["A"] });
  const all = [parent, child];

  it("toont het kind alleen bij de gevraagde ouder-waarde", () => {
    expect(isVisible(child, all, { setup: "A" })).toBe(true);
    expect(isVisible(child, all, { setup: "B" })).toBe(false);
    expect(isVisible(child, all, {})).toBe(false);
  });

  it("toont altijd bij een verweesde of lege voorwaarde", () => {
    expect(isVisible(field({ fieldKey: "x", showWhenFieldId: "weg", showWhenValues: ["A"] }), all, {})).toBe(true);
    expect(isVisible(field({ fieldKey: "x", showWhenFieldId: "p1", showWhenValues: [] }), all, {})).toBe(true);
  });

  it("rekent voor een fase-ouder met de fase die de server meestuurt", () => {
    const fase = field({ fieldKey: "fase", id: "f", options: ["Fase 1", "Fase 2"] });
    const kind = field({ fieldKey: "k", showWhenFieldId: "f", showWhenValues: ["Fase 1"] });
    expect(isVisible(kind, [fase, kind], {})).toBe(true);
  });
});

describe("missingRequired / customFromValues", () => {
  const parent = field({ fieldKey: "setup", id: "p1", fieldType: "enum", options: ["A", "B"] });
  const child = field({ fieldKey: "detail", id: "c1", required: true, showWhenFieldId: "p1", showWhenValues: ["A"] });
  const all = [parent, child];
  const list = formFields(all);

  it("blokkeert alleen op zichtbare, lege verplichte velden", () => {
    expect(missingRequired(list, all, { setup: "A" }).map((f) => f.fieldKey)).toEqual(["detail"]);
    expect(missingRequired(list, all, { setup: "B" })).toEqual([]);
    expect(missingRequired(list, all, { setup: "A", detail: "x" })).toEqual([]);
  });

  it("telt false als een echt boolean-antwoord", () => {
    const bool = field({ fieldKey: "b", fieldType: "boolean", required: true });
    expect(missingRequired([bool], [bool], { b: false })).toEqual([]);
    expect(missingRequired([bool], [bool], { b: null }).map((f) => f.fieldKey)).toEqual(["b"]);
  });

  it("stuurt geen antwoorden mee uit een dichtgeklapte tak", () => {
    expect(customFromValues(list, all, { setup: "B", detail: "oud antwoord" })).toEqual({ setup: "B" });
    expect(customFromValues(list, all, { setup: "A", detail: "x" })).toEqual({ setup: "A", detail: "x" });
  });
});

describe("groupFields", () => {
  it("zet opeenvolgende velden met hetzelfde kopje bij elkaar", () => {
    const groups = groupFields([
      field({ fieldKey: "a", groupLabel: "Setup" }),
      field({ fieldKey: "b", groupLabel: "Setup" }),
      field({ fieldKey: "c", groupLabel: null }),
    ]);
    expect(groups.map((g) => [g.label, g.fields.length])).toEqual([["Setup", 2], [null, 1]]);
  });
});

describe("logTradeErrorCopy", () => {
  it("geeft elke bekende faalcode eigen NL-copy", () => {
    expect(logTradeErrorCopy({ ok: false, stage: "auth", error: "not-linked" }).message).toContain("popup");
    expect(logTradeErrorCopy({ ok: false, stage: "profile", error: "not-beta" }).message).toContain("beta");
    expect(
      logTradeErrorCopy({ ok: false, stage: "build", error: "symbol-not-in-pairs", detail: "XAUUSD" }).message
    ).toContain("XAUUSD");
    expect(logTradeErrorCopy({ ok: false, stage: "insert", error: "missing-column" }).message).toContain("0058");
  });

  it("degradeert netjes op een onbekende code", () => {
    const copy = logTradeErrorCopy({ ok: false, stage: "insert", error: "other", detail: "boem" });
    expect(copy.message).toBe("Loggen is niet gelukt.");
    expect(copy.detail).toBe("boem");
  });

  it("vertaalt zod-sleutels naar leesbare zinnen", () => {
    expect(humanizeSchemaDetail("resultaat_pct: tradeForm.lossMustBeNegative")).toBe(
      "Resultaat % hoort bij een Loss negatief te zijn"
    );
    expect(humanizeSchemaDetail("iets.raars")).toBe("iets.raars");
    expect(humanizeSchemaDetail(undefined)).toBeUndefined();
  });

  it("volgt de taalkeuze van de extensie (F4b)", () => {
    setLang("en");
    try {
      expect(logTradeErrorCopy({ ok: false, stage: "auth", error: "not-linked" }).message).toBe(
        "Not connected — open the extension popup and connect your Beyen account."
      );
      expect(
        logTradeErrorCopy({ ok: false, stage: "build", error: "symbol-not-in-pairs", detail: "XAUUSD" }).message
      ).toContain("XAUUSD");
      // Zonder detail valt hij terug op de vertaalde omschrijving, niet op "undefined".
      expect(
        logTradeErrorCopy({ ok: false, stage: "build", error: "symbol-not-in-pairs" }).message
      ).toContain("This symbol");
      expect(humanizeSchemaDetail("resultaat_pct: tradeForm.lossMustBeNegative")).toBe(
        "Result % should be negative on a Loss"
      );
    } finally {
      setLang("nl");
    }
  });
});

describe("slotStatus-copy (F4b)", () => {
  it("volgt dezelfde taalkeuze als de rest van het paneel", () => {
    const slot = { enabled: true, link: "", result: null };
    expect(slotStatus(slot).text).toBe("Wordt meegenomen bij 'Maak snapshots'.");
    setLang("en");
    try {
      expect(slotStatus(slot).text).toBe("Will be included with 'Take snapshots'.");
      expect(slotStatus({ ...slot, link: "abc" }).text).toContain("https://");
    } finally {
      setLang("nl");
    }
  });
});

// ── Legacy-WPM-velden (spiegel web-form) ────────────────────────────────────
import {
  addableOptions, ccFromTime, faseOptions, isLegacyJournal, legacyConfirmFields, legacyEntryFields,
  legacyFromValues, legacyKenmerkFields, legacyLabelKey, selectedFase,
} from "./fields";
import { LEGACY_TRADE_COLUMNS } from "../../../../src/lib/tradePayload";
import { t } from "../../i18nExt";

describe("ccFromTime", () => {
  it("kiest de close van de 4H-candle waarin de entry valt", () => {
    expect(ccFromTime("14:32")).toBe("15");
    expect(ccFromTime("02:59")).toBe("03");
    expect(ccFromTime("09:00")).toBe("11");
    expect(ccFromTime("18:01")).toBe("19");
    expect(ccFromTime("22:15")).toBe("23");
  });

  it("een entry exact op een slot hoort bij de candle die dan opent", () => {
    expect(ccFromTime("15:00")).toBe("19");
    expect(ccFromTime("03:00")).toBe("07");
    expect(ccFromTime("23:00")).toBe("03"); // sluit pas de volgende dag om 03:00
  });

  it("na 23:00 wikkelt het slot naar 03 (volgende dag)", () => {
    expect(ccFromTime("23:45")).toBe("03");
    expect(ccFromTime("00:10")).toBe("03");
  });

  it("accepteert HH:MM:SS en enkelcijferige uren, weigert rommel", () => {
    expect(ccFromTime("14:32:07")).toBe("15");
    expect(ccFromTime("9:05")).toBe("11");
    expect(ccFromTime("")).toBeNull();
    expect(ccFromTime("morgenvroeg")).toBeNull();
    expect(ccFromTime("25:00")).toBeNull();
    expect(ccFromTime("12:60")).toBeNull();
  });
});

describe("legacyConfirmFields", () => {
  it("levert de vier confirms als booleans", () => {
    expect(legacyConfirmFields().map((f) => f.key)).toEqual(["w_confirm", "d_confirm", "h4_confirm", "extra_d_conf"]);
    expect(legacyConfirmFields().every((f) => f.kind === "boolean")).toBe(true);
  });
});

describe("legacy-veldspecs", () => {
  it("entry-blok volgt de web-form: cc, concept, entry, weekly criteria/kenmerk, nieuws", () => {
    expect(legacyEntryFields().map((f) => f.key)).toEqual([
      "cc", "trade_concept", "entry", "weekly_criteria", "weekly_kenmerk", "nieuws",
    ]);
    expect(legacyEntryFields().find((f) => f.key === "trade_concept")?.kind).toBe("addable");
  });

  it("kenmerken volgen de gekozen fase en slaan computed over", () => {
    expect(legacyKenmerkFields("Fase 3").map((f) => f.key)).toEqual([
      "fase3_zone_min_2_touches", "fase3_engulfing_candle", "fase3_structuur",
    ]);
    expect(legacyKenmerkFields("Fase 4").map((f) => f.key)).toEqual(["fase4_weekly_bevestigingscandle"]);
    expect(legacyKenmerkFields("Onbekend")).toEqual([]);
  });

  it("legacyFromValues neemt alleen beantwoorde velden van de gekozen fase mee", () => {
    const values = {
      cc: "15",
      entry: "",
      nieuws: false,
      fase2_structuur: "Inner",
      fase3_engulfing_candle: true,
      niet_legacy: "x",
    };
    expect(legacyFromValues("Fase 2", values)).toEqual({
      cc: "15",
      nieuws: false,
      fase2_structuur: "Inner",
    });
    // zelfde values, andere fase: het fase-2-antwoord lift niet mee
    expect(legacyFromValues("Fase 3", values)).toEqual({
      cc: "15",
      nieuws: false,
      fase3_engulfing_candle: true,
    });
  });

  it("faseOptions leest de opties van het gezaaide fase-veld", () => {
    expect(faseOptions([])).toEqual([]);
    expect(faseOptions([field({ fieldKey: "fase", options: ["Fase 2", "Fase 4"] })])).toEqual([
      "Fase 2", "Fase 4",
    ]);
  });
});

describe("selectedFase", () => {
  const all = [field({ fieldKey: "fase", options: ["Fase 2", "Fase 1"] })];

  it("volgt de keuze van de user", () => {
    expect(selectedFase(all, { fase: "Fase 1" })).toBe("Fase 1");
  });

  it("valt zonder (bruikbare) keuze terug op de eerste journal-optie", () => {
    // Zo blijft de fase-loze weergave (hide_fase) dezelfde stille default
    // gebruiken als de server.
    expect(selectedFase(all, {})).toBe("Fase 2");
    expect(selectedFase(all, { fase: "" })).toBe("Fase 2");
    expect(selectedFase(all, { fase: 3 })).toBe("Fase 2");
    expect(selectedFase([], {})).toBe("Fase 1");
  });
});

describe("addableOptions", () => {
  it("zet de eigen waarden achter de gedeelde lijst, zonder dubbels", () => {
    expect(addableOptions(["Decel", "Reclaim"], ["Eigen", "Decel"])).toEqual([
      "Decel", "Reclaim", "Eigen",
    ]);
  });

  it("negeert lege waarden en laat de basislijst ongemoeid", () => {
    const base = ["A"] as const;
    expect(addableOptions(base, ["", "B"])).toEqual(["A", "B"]);
    expect(base).toEqual(["A"]);
    expect(addableOptions(base, [])).toEqual(["A"]);
  });
});

describe("legacyLabelKey", () => {
  it("geeft elke legacy-kolom een ingevulde NL- én EN-zin", () => {
    for (const column of LEGACY_TRADE_COLUMNS) {
      const key = legacyLabelKey(column);
      setLang("nl");
      expect(t(key).length).toBeGreaterThan(0);
      setLang("en");
      expect(t(key).length).toBeGreaterThan(0);
      setLang("nl");
    }
  });

  it("houdt de trading-leenwoorden in beide talen gelijk", () => {
    for (const column of ["entry", "trade_concept", "weekly_criteria", "cc"] as const) {
      setLang("nl");
      const nl = t(legacyLabelKey(column));
      setLang("en");
      expect(t(legacyLabelKey(column))).toBe(nl);
      setLang("nl");
    }
  });

  it("vertaalt wél wat een echte zin is", () => {
    setLang("en");
    try {
      expect(t(legacyLabelKey("nieuws"))).toBe("News near trade?");
      expect(t(legacyLabelKey("fase3_structuur"))).toBe("Structure");
    } finally {
      setLang("nl");
    }
  });
});
