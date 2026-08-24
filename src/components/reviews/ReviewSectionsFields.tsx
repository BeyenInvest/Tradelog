import { useTranslation } from "react-i18next";
import { LabeledTextarea, StringListField } from "./ReviewFieldInputs";
import { reviewSectionLabel, type ReviewSection, type ReviewValues } from "@/lib/reviewSections";
import type { ReviewKind } from "@/lib/types";

interface ReviewSectionsFieldsProps {
  kind: ReviewKind;
  sections: ReviewSection[];
  values: ReviewValues;
  onChange: (values: ReviewValues) => void;
}

/**
 * Config-driven editor for a review's sections (Fase N5) — one form path for both
 * weekly and periodic reviews. Text sections render as a labeled textarea, list
 * sections as a growable string-list. When a journal uses the built-in defaults
 * this reproduces the old hand-written field lists (labels, hints, list add
 * labels) exactly.
 */
export function ReviewSectionsFields({ kind, sections, values, onChange }: ReviewSectionsFieldsProps) {
  const { t } = useTranslation();

  function set(key: string, value: string | string[]) {
    onChange({ ...values, [key]: value });
  }

  // Preserve the polished built-in list copy (Acties/Werkpunten add + placeholder),
  // fall back to a generic "add row" for custom list sections.
  function listCopy(section: ReviewSection): { addLabel: string; placeholder: string } {
    if (section.key === "acties") {
      return kind === "periodic"
        ? { addLabel: t("reviewContent.werkpuntenAdd"), placeholder: t("reviewContent.werkpuntenPlaceholder") }
        : { addLabel: t("reviewContent.actiesAdd"), placeholder: t("reviewContent.actiesPlaceholder") };
    }
    return { addLabel: t("reviewSections.addRow"), placeholder: "" };
  }

  return (
    <>
      {sections.map((section) => {
        const label = reviewSectionLabel(t, section);
        if (section.inputType === "list") {
          const { addLabel, placeholder } = listCopy(section);
          const items = Array.isArray(values[section.key]) ? (values[section.key] as string[]) : [];
          return (
            <StringListField
              key={section.key}
              label={label}
              items={items}
              onChange={(v) => set(section.key, v)}
              addLabel={addLabel}
              placeholder={placeholder}
            />
          );
        }
        const value = typeof values[section.key] === "string" ? (values[section.key] as string) : "";
        return (
          <LabeledTextarea
            key={section.key}
            label={label}
            hint={section.hintKey ? t(section.hintKey) : undefined}
            rows={section.rows}
            value={value}
            onChange={(v) => set(section.key, v)}
          />
        );
      })}
    </>
  );
}
