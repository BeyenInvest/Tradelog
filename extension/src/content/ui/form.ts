// Renderer van de dynamische form (F2d): methodology_fields → invoervelden.
// Bouwt de rijen één keer op en verbergt/toont ze daarna alleen nog (show_when),
// zodat typen nooit focus verliest. Alle beslissingen komen uit fields.ts.
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

function booleanControl(field: JournalField, values: FormValues, changed: () => void): HTMLElement {
  const wrap = el("div", { class: "by-toggle" });
  const buttons: HTMLButtonElement[] = [];
  const paint = () => {
    for (const btn of buttons) {
      const isYes = btn.dataset.value === "true";
      btn.classList.toggle("is-active", values[field.fieldKey] === isYes);
    }
  };
  for (const [text, value] of [["Ja", true], ["Nee", false]] as const) {
    const btn = el("button", {
      class: "by-toggle-btn",
      text,
      attrs: { type: "button", "data-value": String(value) },
    });
    on(btn, "click", () => {
      // Nog een keer op het actieve antwoord = terug naar onbeantwoord.
      values[field.fieldKey] = values[field.fieldKey] === value ? null : value;
      paint();
      changed();
    });
    buttons.push(btn);
    wrap.appendChild(btn);
  }
  paint();
  return wrap;
}

function enumControl(field: JournalField, values: FormValues, changed: () => void): HTMLElement {
  const select = el("select", { class: "by-select" });
  select.appendChild(el("option", { text: "— kies —", attrs: { value: "" } }));
  for (const option of fieldOptions(field)) {
    select.appendChild(el("option", { text: option, attrs: { value: option } }));
  }
  select.value = typeof values[field.fieldKey] === "string" ? String(values[field.fieldKey]) : "";
  on(select, "change", () => {
    values[field.fieldKey] = select.value || null;
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
  if (field.fieldType === "boolean") return booleanControl(field, values, changed);
  if (field.fieldType === "enum") return enumControl(field, values, changed);
  return inputControl(field, values, changed);
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

  for (const group of groupFields(fields)) {
    const groupEl = el("div", { class: "by-group" });
    if (group.label) groupEl.appendChild(el("h4", { class: "by-group-title", text: group.label }));
    for (const field of group.fields) {
      const row = el("div", { class: "by-field", attrs: { "data-field": field.fieldKey } }, [
        labelNode(field),
        control(field, values, onChange),
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
