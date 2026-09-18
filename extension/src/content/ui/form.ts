// Renderer van de dynamische form (F2d): methodology_fields → invoervelden.
// Bouwt de rijen één keer op en verbergt/toont ze daarna alleen nog (show_when),
// zodat typen nooit focus verliest. Alle beslissingen komen uit fields.ts.
import { t } from "../../i18nExt";
import type { JournalField } from "../../db";
import { el, on } from "./dom";
import {
  fieldOptions, groupFields, isVisible, type FormValues,
} from "./fields";
import { parseNumberInput } from "./format";

export interface DynamicForm {
  element: HTMLElement;
  /** show_when opnieuw toepassen op de al gebouwde rijen. */
  sync(): void;
  /** Rode rand op de verplichte velden die nog leeg zijn (bij een submit-poging). */
  markMissing(fieldKeys: string[]): void;
}

function labelNode(field: JournalField): HTMLElement {
  const label = el("span", { class: "by-label", text: field.label });
  if (field.required) label.appendChild(el("span", { class: "by-req", text: " *" }));
  return label;
}

/**
 * Ja/Nee-toggle op één values-sleutel (tri-state: nog een keer op het actieve
 * antwoord = terug naar onbeantwoord). Op sleutel en niet op JournalField zodat
 * elke boolean-veldsoort er dezelfde knoppen door krijgt.
 */
export function booleanControl(fieldKey: string, values: FormValues, changed: () => void): HTMLElement {
  const wrap = el("div", { class: "by-toggle" });
  const buttons: HTMLButtonElement[] = [];
  const paint = () => {
    for (const btn of buttons) {
      const isYes = btn.dataset.value === "true";
      btn.classList.toggle("is-active", values[fieldKey] === isYes);
    }
  };
  // De veldlabels zelf komen uit het journal van de user (die kiest z'n eigen
  // taal daar) — alleen de knoppen zijn van ons.
  for (const [text, value] of [[t("form.yes"), true], [t("form.no"), false]] as const) {
    const btn = el("button", {
      class: "by-toggle-btn",
      text,
      attrs: { type: "button", "data-value": String(value) },
    });
    on(btn, "click", () => {
      // Nog een keer op het actieve antwoord = terug naar onbeantwoord.
      values[fieldKey] = values[fieldKey] === value ? null : value;
      paint();
      changed();
    });
    buttons.push(btn);
    wrap.appendChild(btn);
  }
  paint();
  return wrap;
}

/**
 * Keuzelijst met lege placeholder (niets kiezen = niet invullen) op één
 * values-sleutel; de opties komen van de call-site, zodat zowel een
 * journal-enum als een vaste legacy-lijst hier doorheen kan.
 */
export function enumControl(
  fieldKey: string,
  options: readonly string[],
  values: FormValues,
  changed: () => void,
  /** Uit voor een veld dat altijd een waarde hééft (de fase is `not null`). */
  withPlaceholder = true
): HTMLElement {
  const select = el("select", { class: "by-select" });
  if (withPlaceholder) select.appendChild(el("option", { text: t("form.choose"), attrs: { value: "" } }));
  for (const option of options) {
    select.appendChild(el("option", { text: option, attrs: { value: option } }));
  }
  select.value = typeof values[fieldKey] === "string" ? String(values[fieldKey]) : "";
  on(select, "change", () => {
    values[fieldKey] = select.value || null;
    changed();
  });
  return select;
}

function inputControl(field: JournalField, values: FormValues, changed: () => void): HTMLElement {
  const type = field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text";
  const attrs: Record<string, string> = { type };
  if (type === "number") {
    attrs.step = "any";
    attrs.inputmode = "decimal";
  }
  const input = el("input", { class: "by-input", attrs });
  const current = values[field.fieldKey];
  if (current != null) input.value = String(current);
  on(input, "input", () => {
    values[field.fieldKey] = type === "number" ? parseNumberInput(input.value) : input.value || null;
    changed();
  });
  return input;
}

function control(field: JournalField, values: FormValues, changed: () => void): HTMLElement {
  if (field.fieldType === "boolean") return booleanControl(field.fieldKey, values, changed);
  if (field.fieldType === "enum") return enumControl(field.fieldKey, fieldOptions(field), values, changed);
  return inputControl(field, values, changed);
}

/** Één invoerrij: label boven de control, zelfde opbouw als de journal-velden. */
export function fieldRow(fieldKey: string, label: string, control: HTMLElement): HTMLElement {
  return el("div", { class: "by-field", attrs: { "data-field": fieldKey } }, [
    el("span", { class: "by-label", text: label }),
    control,
  ]);
}

export function renderDynamicForm(options: {
  /** Volledige veldenlijst — nodig om een show_when-ouder terug te vinden. */
  allFields: JournalField[];
  /** De velden die het paneel rendert (formFields()). */
  fields: JournalField[];
  values: FormValues;
  onChange: () => void;
}): DynamicForm {
  const { allFields, fields, values, onChange } = options;
  const element = el("div");
  const rows = new Map<string, HTMLElement>();
  // De keuzelijsten per sleutel: sync() kan ze uit `values` bijwerken wanneer het
  // paneel zélf een waarde zet (de CC-prefill uit de entry-tijd) — een re-render
  // van de rij zou focus en caret kosten. Alleen selects: tekst/nummer-velden
  // worden nooit programmatisch gevuld en re-setten zou daar de caret verspringen.
  const selects = new Map<string, HTMLSelectElement>();

  for (const group of groupFields(fields)) {
    const groupEl = el("div", { class: "by-group" });
    if (group.label) groupEl.appendChild(el("h4", { class: "by-group-title", text: group.label }));
    for (const field of group.fields) {
      const ctrl = control(field, values, onChange);
      if (ctrl instanceof HTMLSelectElement) selects.set(field.fieldKey, ctrl);
      const row = el("div", { class: "by-field", attrs: { "data-field": field.fieldKey } }, [
        labelNode(field),
        ctrl,
      ]);
      rows.set(field.fieldKey, row);
      groupEl.appendChild(row);
    }
    element.appendChild(groupEl);
  }

  const sync = () => {
    for (const field of fields) {
      const row = rows.get(field.fieldKey);
      if (row) row.hidden = !isVisible(field, allFields, values);
    }
    for (const [key, select] of selects) {
      const value = values[key];
      select.value = typeof value === "string" ? value : "";
    }
  };
  sync();

  return {
    element,
    sync,
    markMissing(fieldKeys) {
      const missing = new Set(fieldKeys);
      for (const [key, row] of rows) row.classList.toggle("is-missing", missing.has(key));
    },
  };
}
