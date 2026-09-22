import { useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { emptyDefaults } from "@/components/trades/TradeForm";
import { EntrySection } from "@/components/trades/TradeFormSections/EntrySection";
import { ResultSection } from "@/components/trades/TradeFormSections/ResultSection";
import { TechnicalSection } from "@/components/trades/TradeFormSections/TechnicalSection";
import {
  CustomFieldVisibilitySync,
  CustomFieldsManager,
} from "@/components/trades/TradeFormSections/CustomFieldsSection";

/**
 * Read-only preview of the trade form, shown under the field editor so a user sees
 * exactly how a change lands without leaving Settings (owner feedback 2026-09-22).
 *
 * It renders the REAL trade-form sections (Entry / Result / Technical / Extra velden)
 * inside a throwaway FormProvider — not a hand-built copy — so the layout is
 * guaranteed identical to logging a trade, including WPM's fixed field order and the
 * screenshots/notes block. The sections read the shared methodology context, which
 * the editor refreshes after every save, so the preview stays live. Wrapped in
 * `pointer-events-none` + `aria-hidden`: it's a picture of the form, not a second
 * place to log a trade (and it can't accidentally fire a screenshot upload).
 */
export function MethodologyPreview() {
  const methods = useForm<TradeFormValues>({ defaultValues: emptyDefaults() });
  // The section components take this ref (open-date → close-date auto-follow); it's
  // inert here since nothing is interactive, but they require it.
  const closeDateTouchedRef = useRef(false);

  return (
    <div className="rounded-xl border border-border-soft bg-surface-2/40 p-4">
      <div aria-hidden className="pointer-events-none select-none flex flex-col gap-8">
        <FormProvider {...methods}>
          <CustomFieldVisibilitySync />
          <EntrySection closeDateTouchedRef={closeDateTouchedRef} />
          <hr className="border-border" />
          <ResultSection allowMissedTrade closeDateTouchedRef={closeDateTouchedRef} />
          <hr className="border-border" />
          <TechnicalSection />
          <CustomFieldsManager />
        </FormProvider>
      </div>
    </div>
  );
}
