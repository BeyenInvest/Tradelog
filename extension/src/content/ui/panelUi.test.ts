// Unit-tests voor de pure paneel-laag (F2d): formattering, foutcopy en de
// beslisregels van de dynamische form. De DOM-kant (form.ts/panelApp.ts) wordt
// hier bewust niet getest — die is handmatig owner-getest in echte Chrome.
import { describe, expect, it } from "vitest";
import type { JournalField } from "../../db";
import { setLang } from "../../i18nExt";
import { humanizeSchemaDetail, logTradeErrorCopy } from "./errors";
import { slotStatus } from "./snapshotState";
import {
  ccFromTime, customFromValues, formFields, groupFields, isVisible, missingRequired,
  orderedFormFields,
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
  const fields = [
    field({ fieldKey: "fase", options: ["Fase 2", "Fase 1"], sortOrder: 0 }),
    field({ fieldKey: "structuur", sortOrder: 2 }),
    field({ fieldKey: "eigen_veld", sortOrder: 1 }),
    field({ fieldKey: "berekend", sortOrder: 3, isComputed: true }),
  ];

  it("houdt alle niet-computed velden (incl. fase/kenmerken), op sortOrder", () => {
    // Sinds de fase-retirement zijn fase, cc en de fase-kenmerken gewone
    // methodology_fields die het paneel via het generieke pad rendert; alleen
    // computed velden vallen weg.
    expect(formFields(fields).map((f) => f.fieldKey)).toEqual(["fase", "eigen_veld", "structuur"]);
  });

  it("laat computed velden weg en houdt de sortOrder aan", () => {
    const modern = [field({ fieldKey: "structuur" }), field({ fieldKey: "notitie", sortOrder: 1 })];
    expect(formFields(modern).map((f) => f.fieldKey)).toEqual(["structuur", "notitie"]);
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

  it("behandelt een fase-ouder als elk ander veld (uniform values[fieldKey])", () => {
    // Sinds de fase-retirement is er geen fase-special-case meer: zonder een
    // fase-keuze in values blijft een fase-afhankelijk kenmerk verborgen.
    const fase = field({ fieldKey: "fase", id: "f", options: ["Fase 1", "Fase 2"] });
    const kind = field({ fieldKey: "k", showWhenFieldId: "f", showWhenValues: ["Fase 1"] });
    expect(isVisible(kind, [fase, kind], {})).toBe(false);
    expect(isVisible(kind, [fase, kind], { fase: "Fase 1" })).toBe(true);
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

describe("orderedFormFields (WPM-paneelvolgorde)", () => {
  // Een WPM-journal zoals het paneel het binnenkrijgt: fase eerst, kenmerk+nieuws
  // in een aparte "Markt"-groep ná de confirms — de stand van vóór deze fix.
  const wpm = () => [
    field({ fieldKey: "fase", groupLabel: null, sortOrder: 0 }),
    field({ fieldKey: "weekly_criteria", groupLabel: null, sortOrder: 1 }),
    field({ fieldKey: "trade_concept", groupLabel: null, sortOrder: 2 }),
    field({ fieldKey: "entry", groupLabel: null, sortOrder: 3 }),
    field({ fieldKey: "w_confirm", groupLabel: null, sortOrder: 4 }),
    field({ fieldKey: "d_confirm", groupLabel: null, sortOrder: 5 }),
    field({ fieldKey: "h4_confirm", groupLabel: null, sortOrder: 6 }),
    field({ fieldKey: "extra_d_conf", groupLabel: null, sortOrder: 7 }),
    field({ fieldKey: "weekly_kenmerk", groupLabel: "Markt", sortOrder: 8 }),
    field({ fieldKey: "nieuws", groupLabel: "Markt", sortOrder: 9 }),
  ];

  it("zet kenmerk onder fase en nieuws vlak boven de confirms (vaste WPM-volgorde)", () => {
    expect(orderedFormFields(wpm()).map((f) => f.fieldKey)).toEqual([
      "fase", "weekly_kenmerk", "weekly_criteria", "trade_concept", "entry",
      "nieuws",
      "w_confirm", "d_confirm", "h4_confirm", "extra_d_conf",
    ]);
  });

  it("neutraliseert het 'Markt'-kopje zodat er geen aparte groep meer tekent", () => {
    const groups = groupFields(orderedFormFields(wpm()));
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it("laat eigen extra velden achteraan staan (op sortOrder) mét hun groep", () => {
    const withExtra = [
      ...wpm(),
      field({ fieldKey: "setup_kwaliteit", groupLabel: "Eigen velden", sortOrder: 20 }),
    ];
    const ordered = orderedFormFields(withExtra);
    expect(ordered[ordered.length - 1].fieldKey).toBe("setup_kwaliteit");
    expect(ordered[ordered.length - 1].groupLabel).toBe("Eigen velden");
  });

  it("laat een niet-WPM journal (geen fase-veld) volledig ongemoeid", () => {
    const generic = [
      field({ fieldKey: "session", groupLabel: "Markt", sortOrder: 0 }),
      field({ fieldKey: "emotion", groupLabel: "Mindset", sortOrder: 1 }),
    ];
    expect(orderedFormFields(generic)).toEqual(generic);
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

describe("ccFromTime", () => {
  it("kiest de meest recente 4H-close op of vóór de entry (WPM: close bevestigt → instappen)", () => {
    expect(ccFromTime("14:32")).toBe("11");
    expect(ccFromTime("04:59")).toBe("03");
    expect(ccFromTime("09:00")).toBe("07");
    expect(ccFromTime("18:01")).toBe("15");
    expect(ccFromTime("22:15")).toBe("19");
  });

  it("een entry exact op een slot hoort bij dié close (owner 18-09: 11:00 → CC 11)", () => {
    expect(ccFromTime("11:00")).toBe("11");
    expect(ccFromTime("15:00")).toBe("15");
    expect(ccFromTime("03:00")).toBe("03");
    expect(ccFromTime("23:00")).toBe("23");
  });

  it("vóór 03:00 is de recentste close de 23 van de dag ervoor", () => {
    expect(ccFromTime("00:10")).toBe("23");
    expect(ccFromTime("02:59")).toBe("23");
  });

  it("accepteert HH:MM:SS en enkelcijferige uren, weigert rommel", () => {
    expect(ccFromTime("14:32:07")).toBe("11");
    expect(ccFromTime("9:05")).toBe("07");
    expect(ccFromTime("")).toBeNull();
    expect(ccFromTime("morgenvroeg")).toBeNull();
    expect(ccFromTime("25:00")).toBeNull();
    expect(ccFromTime("12:60")).toBeNull();
  });
});
