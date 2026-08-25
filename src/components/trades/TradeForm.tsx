import { useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { tradeSchema, type TradeFormValues } from "@/lib/validation";
import type { Trade } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useModalGuard } from "@/hooks/useModalGuard";
import { toErrorMessage } from "@/lib/errorMessage";
import { localTodayIso } from "@/lib/localDate";
import { removeScreenshots, screenshotStoragePaths } from "@/lib/storage/screenshots";
import { useMethodology } from "@/hooks/useMethodology";
import { normalizeInstrument } from "@/lib/instruments";
import { missingRequiredCustomFields } from "@/lib/methodologyFields";
import { getLastInstrument, getLastRisk, setLastInstrument, setLastRisk } from "@/lib/tradeMemory";
import { PAIRS } from "@/lib/constants";
import { EntrySection } from "./TradeFormSections/EntrySection";
import { ResultSection } from "./TradeFormSections/ResultSection";
import { TechnicalSection } from "./TradeFormSections/TechnicalSection";
import { CustomFieldsSection } from "./TradeFormSections/CustomFieldsSection";

interface TradeFormProps {
  trade?: Trade;
  onSubmit: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
  /** false when opened from within a backtest project — "Missed trade" isn't offered there. */
  allowMissedTrade: boolean;
  /** Pre-fills datum_open for a new trade, e.g. when opened from a calendar day. Ignored when editing (`trade` wins). */
  initialDate?: string;
}

// A function, not a module-level constant: "today" must be evaluated when the
// form opens — a PWA tab can stay open for days (M2), and toISOString() is UTC.
function emptyDefaults(): TradeFormValues {
  return {
    fase: "Fase 1",
    datum_open: localTodayIso(),
    tijd_open: null,
    datum_sluiting: null,
    pair: "EURUSD",
    instrument: null,
    direction: null,
    is_open: false,
    outcome: "Win",
    resultaat_pct: 0,
    risk_pct: null,
    trade_evaluation: null,
    mae_pct: null,
    mfe_pct: null,
    planned_rr: null,
    weekly_criteria: null,
    weekly_kenmerk: null,
    trade_concept: null,
    entry: null,
    cc: "11",
    nieuws: false,
    w_confirm: null,
    d_confirm: null,
    h4_confirm: null,
    w_screenshot: null,
    d_screenshot: null,
    h4_screenshot: null,
    h2_screenshot: null,
    extra_d_conf: null,
    notes: null,
    fase1_daily_respecteert_zone: null,
    fase1_spelers_verleden: null,
    fase2_daily_respecteert_zone: null,
    fase2_structuur: null,
    fase3_zone_min_2_touches: null,
    fase3_engulfing_candle: null,
    fase3_structuur: null,
    fase4_weekly_bevestigingscandle: null,
    custom: {},
    methodology_id: null,
  };
}

function tradeToDefaults(trade: Trade): TradeFormValues {
  return {
    fase: trade.fase,
    datum_open: trade.datum_open,
    // DB returns "HH:MM:SS"; <input type="time"> wants "HH:MM".
    tijd_open: trade.tijd_open ? trade.tijd_open.slice(0, 5) : null,
    datum_sluiting: trade.datum_sluiting,
    pair: trade.pair,
    instrument: trade.instrument,
    direction: trade.direction,
    is_open: trade.is_open,
    outcome: trade.outcome,
    resultaat_pct: trade.resultaat_pct,
    risk_pct: trade.risk_pct,
    trade_evaluation: trade.trade_evaluation,
    mae_pct: trade.mae_pct,
    mfe_pct: trade.mfe_pct,
    planned_rr: trade.planned_rr,
    weekly_criteria: trade.weekly_criteria,
    weekly_kenmerk: trade.weekly_kenmerk,
    trade_concept: trade.trade_concept,
    entry: trade.entry,
    cc: trade.cc,
    nieuws: trade.nieuws,
    w_confirm: trade.w_confirm,
    d_confirm: trade.d_confirm,
    h4_confirm: trade.h4_confirm,
    w_screenshot: trade.w_screenshot,
    d_screenshot: trade.d_screenshot,
    h4_screenshot: trade.h4_screenshot,
    h2_screenshot: trade.h2_screenshot,
    extra_d_conf: trade.extra_d_conf,
    notes: trade.notes,
    fase1_daily_respecteert_zone: trade.fase1_daily_respecteert_zone,
    fase1_spelers_verleden: trade.fase1_spelers_verleden,
    fase2_daily_respecteert_zone: trade.fase2_daily_respecteert_zone,
    fase2_structuur: trade.fase2_structuur,
    fase3_zone_min_2_touches: trade.fase3_zone_min_2_touches,
    fase3_engulfing_candle: trade.fase3_engulfing_candle,
    fase3_structuur: trade.fase3_structuur,
    fase4_weekly_bevestigingscandle: trade.fase4_weekly_bevestigingscandle,
    custom: trade.custom ?? {},
    methodology_id: trade.methodology_id,
  };
}

/** Drop empty/in-progress values so trades.custom only stores answered fields (string|number|boolean). */
function pruneCustom(raw: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && Number.isNaN(v)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function TradeForm({ trade, onSubmit, onClose, allowMissedTrade, initialDate }: TradeFormProps) {
  const { t } = useTranslation();
  const { methodology, fields, isForexJournal } = useMethodology();
  const methodologyId = methodology?.id ?? null;

  // A new trade opens pre-filled with the instrument + risk last logged in this
  // journal (Fase S1, tradeMemory) — a friction cut, both stay editable. Editing
  // an existing trade never prefills (its own values win).
  function newTradeDefaults(): TradeFormValues {
    const base = emptyDefaults();
    if (initialDate) base.datum_open = initialDate;
    const lastRisk = getLastRisk(methodologyId);
    const lastInstrument = getLastInstrument(methodologyId);
    if (lastRisk != null) base.risk_pct = lastRisk;
    if (lastInstrument) {
      if (isForexJournal) {
        if ((PAIRS as readonly string[]).includes(lastInstrument)) base.pair = lastInstrument as typeof base.pair;
      } else {
        base.instrument = lastInstrument;
      }
    }
    return base;
  }

  const methods = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: trade ? tradeToDefaults(trade) : newTradeDefaults(),
  });
  const {
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;
  const [error, setError] = useState<string | null>(null);
  // QoL: the close date auto-follows the open date until the user edits it themselves.
  // Seeded `true` when a close date already exists on load (editing a real trade), so an
  // open-date correction never clobbers a deliberately recorded close date.
  const closeDateTouchedRef = useRef(Boolean(trade?.datum_sluiting));
  // N2-lifecycle: screenshot uploads happen immediately on file pick, so closing
  // the form WITHOUT saving would orphan those files in the private bucket.
  // Anything that is a storage path at close time but wasn't referenced by the
  // row on open was uploaded in this session — safe to delete. Guarded by
  // savedRef: after a successful save those same paths ARE referenced.
  const savedRef = useRef(false);
  function cleanupUnsavedUploads() {
    if (savedRef.current) return;
    const values = methods.getValues();
    const preexisting = new Set(trade ? screenshotStoragePaths(trade) : []);
    void removeScreenshots(screenshotStoragePaths(values).filter((p) => !preexisting.has(p)));
  }
  const closeAndCleanup = () => {
    cleanupUnsavedUploads();
    onClose();
  };
  const { requestClose, containerRef, discardDialog } = useModalGuard<HTMLDivElement>(isDirty, closeAndCleanup);

  async function handleFormSubmit(values: TradeFormValues) {
    setError(null);

    // Per-journal requirements the static tradeSchema can't know: the journal's
    // own required custom fields, and the instrument on a non-forex journal
    // (blank would fall back to the hidden placeholder pair — "EURUSD" — in
    // every list/PDF/breakdown). Enforced here, surfaced as normal field errors.
    // Only for trades of the active journal — a backtest trade logged under a
    // different journal (projects are journal-orthogonal) can't be held to this
    // journal's rules.
    const ownJournalTrade = !trade || (trade.methodology_id ?? null) === (methodology?.id ?? null);
    let blocked = false;
    if (ownJournalTrade && !isForexJournal && !normalizeInstrument(values.instrument ?? "")) {
      methods.setError("instrument", { type: "required", message: "tradeForm.required" });
      blocked = true;
    }
    if (ownJournalTrade) {
      for (const f of missingRequiredCustomFields(fields, values.fase, values.custom ?? {})) {
        methods.setError(`custom.${f.field_key}`, { type: "required", message: "tradeForm.required" });
        blocked = true;
      }
    }
    if (blocked) return;

    // A forex journal's instrument IS its pair (the form shows the pair enum) —
    // but only mirror when the trade itself is forex-shaped (new, or instrument
    // already mirroring pair). A backtest trade from a non-forex journal is
    // editable here too (projects are journal-orthogonal); its real instrument
    // must never be overwritten by the hidden placeholder pair.
    const mirrorPair = isForexJournal && (!trade || trade.instrument == null || trade.instrument === trade.pair);

    try {
      const payload: TradeSubmitInput = {
        ...values,
        // A still-running trade carries no realized result: force the result-side
        // fields null (belt-and-braces over the schema) so a leftover value — e.g.
        // after re-opening a previously closed trade — can't violate the DB check
        // (trades_open_result_chk) or slip into a stat.
        // MAE/MFE describe the finished trade — forced null while open (DB check
        // trades_open_no_excursion_chk); planned_rr survives, it's the entry plan.
        ...(values.is_open
          ? { outcome: null, resultaat_pct: null, datum_sluiting: null, trade_evaluation: null, mae_pct: null, mfe_pct: null }
          : {}),
        // Record which journal this trade belongs to. Editing keeps the trade's
        // own methodology; a new trade takes the active one — but NEVER a system
        // template: useMethodology falls back to the WPM template when the
        // profile has no journal, and stamping that id would file the trade into
        // a shared system row (audit blocker N1; the DB trigger
        // trg_trades_journal_ownership now rejects it server-side too).
        methodology_id:
          values.methodology_id ?? (methodology && !methodology.is_system ? methodology.id : null),
        // Normalize the free (non-forex) instrument so "es"/"ES"/" es " fold to one
        // Per-Instrument row (cyclus D). The pair enum is already canonical.
        instrument: mirrorPair ? values.pair : normalizeInstrument(values.instrument ?? "") || null,
        custom: pruneCustom(values.custom ?? {}),
      };
      await onSubmit(payload);
      savedRef.current = true; // the uploaded paths are persisted now — don't clean them up
      // Remember what a new trade was logged with, so the next new one prefills it
      // (Fase S1). Only on create — editing an old trade must not reset the memory.
      if (!trade) {
        setLastInstrument(methodologyId, payload.instrument);
        setLastRisk(methodologyId, payload.risk_pct);
      }
      onClose();
    } catch (err) {
      setError(toErrorMessage(err, t("tradeForm.saveFailed")));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={requestClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trade-form-title"
        className="w-full max-w-2xl h-full bg-surface border-l border-border overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="trade-form-title" className="font-display text-2xl italic text-ink">{trade ? t("tradeForm.editTitle") : t("journal.newTrade")}</h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-8">
            <EntrySection closeDateTouchedRef={closeDateTouchedRef} />
            <hr className="border-border" />
            <ResultSection allowMissedTrade={allowMissedTrade} closeDateTouchedRef={closeDateTouchedRef} />
            <hr className="border-border" />
            <TechnicalSection />
            <CustomFieldsSection />

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
              >
                {isSubmitting ? t("common.submitting") : trade ? t("common.save") : t("tradeForm.addTrade")}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
      {discardDialog}
    </div>
  );
}
