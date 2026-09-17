// Het legacy-WPM-blok van het paneel: fase-select, entry-velden, de
// multi-timeframe-confirms en de kenmerken van de gekozen fase. Dit zijn de
// velden die de web-form op een legacy journal hardcoded toont
// (EntrySection/TechnicalSection/FaseKenmerkenSection) en die niet in de
// custom-bag horen maar in echte trades.*-kolommen — de dataketen daarvoor
// (LogTradeRequest.fase + .legacy) ligt al.
//
// Twee regels, zoals de rest van het paneel:
//  1. Er wordt hier NIETS beslist. Welke velden er zijn, welke opties ze dragen
//     en wat er bij submit meegaat komt uit fields.ts; hier staat alleen DOM.
//  2. Alleen het kenmerken-blok wordt herbouwd (bij een fase-wissel). De rest
//     blijft staan, zodat een wissel geen focus of antwoord kost.
import { HIDE_FASE_KENMERKEN } from "../../../../src/lib/constants";
import type { LegacyTradeColumn } from "../../../../src/lib/tradePayload";
import type { JournalField } from "../../db";
import { t } from "../../i18nExt";
import { clear, el } from "./dom";
import {
  addableOptions, faseOptions, legacyConfirmFields, legacyEntryFields, legacyKenmerkFields,
  legacyLabelKey, selectedFase, type FormValues, type LegacyFieldSpec,
} from "./fields";
import { booleanControl, enumControl, fieldRow } from "./form";

/** De eigen extra waarden van de user voor de twee addable-velden (custom_options). */
export interface LegacyCustomOptions {
  entry: string[];
  tradeConcept: string[];
}

export interface LegacyForm {
  element: HTMLElement;
}

export function renderLegacyForm(options: {
  /** De volledige veldenlijst van het journal — draagt de fase-opties. */
  allFields: JournalField[];
  values: FormValues;
  /** profiles.hide_fase: geen fase-select én geen fase-kenmerken, zoals de web-form. */
  hideFase: boolean;
  customOptions: LegacyCustomOptions;
  onChange: () => void;
}): LegacyForm {
  const { allFields, values, hideFase, customOptions, onChange } = options;
  const element = el("div");

  function optionsFor(spec: LegacyFieldSpec): readonly string[] {
    if (spec.kind === "boolean") return [];
    if (spec.kind === "enum") return spec.options;
    // De twee custom_options-velden: vaste lijst + de eigen waarden van de user.
    const own = spec.key === "entry" ? customOptions.entry : customOptions.tradeConcept;
    return addableOptions(spec.options, own);
  }

  /** Eén legacy-veld → rij; label uit de mini-woordenlijst (NL = web-form-label). */
  function row(spec: LegacyFieldSpec): HTMLElement {
    const key: LegacyTradeColumn = spec.key;
    const control =
      spec.kind === "boolean"
        ? booleanControl(key, values, onChange)
        : enumControl(key, optionsFor(spec), values, onChange);
    return fieldRow(key, t(legacyLabelKey(key)), control);
  }

  function group(title: string, rows: HTMLElement[]): HTMLElement {
    return el("div", { class: "by-group" }, [
      el("h4", { class: "by-group-title", text: title }),
      ...rows,
    ]);
  }

  // ── Entry-blok (met de fase-select bovenaan, zoals de web-form) ────────────
  const entryRows: HTMLElement[] = [];
  const fases = faseOptions(allFields);
  if (!hideFase && fases.length > 0) {
    // De keuze moet meteen in values staan: show_when-velden die op de fase
    // wachten rekenen ermee, en bij submit gaat 'm dezelfde waarde in.
    values["fase"] = selectedFase(allFields, values);
    // Geen "— kies —": de fase is `not null`, er is er altijd één gekozen.
    const select = enumControl(
      "fase",
      fases,
      values,
      () => {
        paintKenmerken();
        onChange();
      },
      false
    );
    entryRows.push(fieldRow("fase", t("legacy.fase"), select));
  }
  for (const spec of legacyEntryFields()) entryRows.push(row(spec));
  element.appendChild(group(t("legacy.sec.entry"), entryRows));

  // ── Confirms (TechnicalSection) ───────────────────────────────────────────
  element.appendChild(
    group(t("legacy.sec.technical"), legacyConfirmFields().map((spec) => row(spec)))
  );

  // ── Fase-kenmerken: volgen de gekozen fase ────────────────────────────────
  const kenmerkenTitle = el("h4", { class: "by-group-title" });
  const kenmerkenBody = el("div");
  const kenmerken = el("div", { class: "by-group" }, [kenmerkenTitle, kenmerkenBody]);

  function paintKenmerken(): void {
    clear(kenmerkenBody);
    // Globale kill-switch (HIDE_FASE_KENMERKEN) verbergt de kenmerk-vragen voor
    // iedereen, net als de web-form (TechnicalSection) — bovenop de per-user
    // hideFase-toggle. legacyKenmerkFields blijft puur; enkel de render valt weg.
    if (hideFase || HIDE_FASE_KENMERKEN) {
      kenmerken.hidden = true;
      return;
    }
    const fase = selectedFase(allFields, values);
    const specs = legacyKenmerkFields(fase);
    kenmerken.hidden = specs.length === 0;
    kenmerkenTitle.textContent = t("legacy.sec.kenmerken", { fase });
    // De antwoorden van een andere fase blijven in values staan (legacyFromValues
    // scoopt ze er bij submit uit) — terugwisselen kost je invoer dus niet.
    for (const spec of specs) kenmerkenBody.appendChild(row(spec));
  }
  paintKenmerken();
  element.appendChild(kenmerken);

  return { element };
}
