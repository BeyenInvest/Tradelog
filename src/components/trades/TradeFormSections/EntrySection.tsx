import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TradeFormValues } from "@/lib/validation";
import { CCS, DIRECTIONS, ENTRIES, PAIRS, TRADE_CONCEPTS, WEEKLY_CRITERIA, WEEKLY_KENMERKEN } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCustomOptions } from "@/hooks/useCustomOptions";
import { useMethodology } from "@/hooks/useMethodology";
import { InstrumentSelect } from "../InstrumentSelect";
import { AddableSelect } from "../AddableSelect";
import { Field } from "./Field";

interface EntrySectionProps {
  /** Shared with ResultSection: false while the close date still auto-follows the open date. */
  closeDateTouchedRef: React.MutableRefObject<boolean>;
}

export function EntrySection({ closeDateTouchedRef }: EntrySectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TradeFormValues>();
  const { hideFase } = useAuth();
  const { t } = useTranslation();
  const { faseNames, isLegacyMethodology, isForexJournal, instruments, addInstrument } = useMethodology();
  // Entry & Trade concept are the two custom_options-backed fields (plain text
  // columns) — add/remove own values straight from the form via AddableSelect.
  const { options: customEntries, addOption: addEntry, deleteOption: deleteEntry } = useCustomOptions("entry");
  const {
    options: customConcepts,
    addOption: addConcept,
    deleteOption: deleteConcept,
  } = useCustomOptions("trade_concept");

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">{t("tradeForm.sectionEntry")}</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* fase is legacy (Weekly Phase Method) AND further hideable per-user. Rendered as an
            editable select only for a legacy journal with fasen shown; otherwise a hidden input
            keeps the `not null` column satisfied by the default. */}
        {isLegacyMethodology && !hideFase ? (
          <Field label={t("tradeForm.fase")} error={errors.fase?.message}>
            <EnumSelect options={faseNames} {...register("fase")} />
          </Field>
        ) : (
          <input type="hidden" {...register("fase")} />
        )}
        <Field label={t("tradeForm.datumOpen")} error={errors.datum_open?.message}>
          <input
            type="date"
            className="input"
            {...register("datum_open", {
              onChange: (e) => {
                // QoL: keep the close date in sync with the open date, so the close-date
                // calendar opens in the right week and only the day still needs changing.
                // Stops as soon as the user edits the close date themselves (see ResultSection).
                const open = e.target.value;
                if (open && !closeDateTouchedRef.current) {
                  setValue("datum_sluiting", open, { shouldDirty: true, shouldValidate: true });
                }
              },
            })}
          />
        </Field>
        {/* Optional real open time (Fase S2, 0051). Un-gated (UX-D): the session/hour
            breakdowns it feeds are available to everyone, so gating the input that
            fills them was a dead promise. When filled, the DB derives `sessie` from
            it (real time axis) and the trade joins the hour/session breakdowns. */}
        <Field label={t("tradeForm.tijdOpen")} error={errors.tijd_open?.message}>
          <input type="time" className="input" {...register("tijd_open")} />
        </Field>
        {/* Instrument: a forex journal picks from the fixed pair enum (and mirrors it
            into `instrument` on submit); any other journal types its own symbol
            (ticker/coin/contract) and pair stays on its hidden default (cyclus 7). */}
        {isForexJournal ? (
          <Field label={t("tradeForm.pair")} error={errors.pair?.message}>
            <EnumSelect options={PAIRS} {...register("pair")} />
          </Field>
        ) : (
          <>
            <Field label={t("tradeForm.instrument")} error={errors.instrument?.message}>
              <Controller
                name="instrument"
                control={control}
                render={({ field }) => (
                  <InstrumentSelect
                    options={instruments}
                    value={field.value}
                    onChange={field.onChange}
                    onAddInstrument={addInstrument}
                  />
                )}
              />
            </Field>
            <input type="hidden" {...register("pair")} />
          </>
        )}
        {/* Direction is universal core (Long/Short) — shown for every journal, legacy
            or not. The column is nullable, so legacy trades logged before it existed
            simply stay null. */}
        <Field label={t("tradeForm.direction")} error={errors.direction?.message}>
          <EnumSelect options={DIRECTIONS} {...register("direction")} placeholder={t("tradeForm.directionPlaceholder")} />
        </Field>
        {/* The rest of this section is the Weekly Phase Method's hardcoded legacy block
            (cc, concept, entry, weekly criteria/kenmerk, news). An own or empty journal only
            sees the universal core above + its own custom fields (CustomFieldsSection). cc stays
            `not null`, so when gated out a hidden input still submits its default. */}
        {isLegacyMethodology ? (
          <>
            <Field label={t("tradeForm.cc")} error={errors.cc?.message}>
              <EnumSelect options={CCS} {...register("cc")} />
            </Field>
            <Field label={t("tradeForm.tradeConcept")} error={errors.trade_concept?.message}>
              <Controller
                name="trade_concept"
                control={control}
                render={({ field }) => (
                  <AddableSelect
                    baseOptions={TRADE_CONCEPTS}
                    customOptions={customConcepts}
                    value={field.value}
                    onChange={field.onChange}
                    onAdd={addConcept}
                    onDeleteOption={deleteConcept}
                  />
                )}
              />
            </Field>
            <Field label={t("tradeForm.entry")} error={errors.entry?.message}>
              <Controller
                name="entry"
                control={control}
                render={({ field }) => (
                  <AddableSelect
                    baseOptions={ENTRIES}
                    customOptions={customEntries}
                    value={field.value}
                    onChange={field.onChange}
                    onAdd={addEntry}
                    onDeleteOption={deleteEntry}
                  />
                )}
              />
            </Field>
            <Field label={t("tradeForm.weeklyCriteria")} error={errors.weekly_criteria?.message}>
              <EnumSelect options={WEEKLY_CRITERIA} {...register("weekly_criteria")} />
            </Field>
            <Field label={t("tradeForm.weeklyKenmerk")} error={errors.weekly_kenmerk?.message}>
              <EnumSelect options={WEEKLY_KENMERKEN} {...register("weekly_kenmerk")} />
            </Field>
            <Field label={t("tradeForm.newsNearTrade")}>
              <Controller
                name="nieuws"
                control={control}
                render={({ field }) => <BooleanToggle value={field.value} onChange={field.onChange} />}
              />
            </Field>
          </>
        ) : (
          <input type="hidden" {...register("cc")} />
        )}
      </div>
    </div>
  );
}
