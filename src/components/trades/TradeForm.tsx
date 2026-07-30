import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { tradeSchema, type TradeFormValues } from "@/lib/validation";
import type { Trade } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useModalGuard } from "@/hooks/useModalGuard";
import { toErrorMessage } from "@/lib/errorMessage";
import { EntrySection } from "./TradeFormSections/EntrySection";
import { ResultSection } from "./TradeFormSections/ResultSection";
import { TechnicalSection } from "./TradeFormSections/TechnicalSection";

interface TradeFormProps {
  trade?: Trade;
  onSubmit: (input: TradeSubmitInput) => Promise<void>;
  onClose: () => void;
  /** false when opened from within a backtest project — "Missed trade" isn't offered there. */
  allowMissedTrade: boolean;
}

const EMPTY_DEFAULTS: TradeFormValues = {
  fase: "Fase 1",
  datum_open: new Date().toISOString().slice(0, 10),
  datum_sluiting: null,
  pair: "EURUSD",
  outcome: "Win",
  resultaat_pct: 0,
  trade_evaluation: null,
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
  tpfs_pct: null,
  notes: null,
  fase1_daily_respecteert_zone: null,
  fase1_spelers_verleden: null,
  fase2_daily_respecteert_zone: null,
  fase2_structuur: null,
  fase3_zone_min_2_touches: null,
  fase3_engulfing_candle: null,
  fase3_structuur: null,
  fase4_weekly_bevestigingscandle: null,
};

function tradeToDefaults(trade: Trade): TradeFormValues {
  return {
    fase: trade.fase,
    datum_open: trade.datum_open,
    datum_sluiting: trade.datum_sluiting,
    pair: trade.pair,
    outcome: trade.outcome,
    resultaat_pct: trade.resultaat_pct,
    trade_evaluation: trade.trade_evaluation,
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
    tpfs_pct: trade.tpfs_pct,
    notes: trade.notes,
    fase1_daily_respecteert_zone: trade.fase1_daily_respecteert_zone,
    fase1_spelers_verleden: trade.fase1_spelers_verleden,
    fase2_daily_respecteert_zone: trade.fase2_daily_respecteert_zone,
    fase2_structuur: trade.fase2_structuur,
    fase3_zone_min_2_touches: trade.fase3_zone_min_2_touches,
    fase3_engulfing_candle: trade.fase3_engulfing_candle,
    fase3_structuur: trade.fase3_structuur,
    fase4_weekly_bevestigingscandle: trade.fase4_weekly_bevestigingscandle,
  };
}

export function TradeForm({ trade, onSubmit, onClose, allowMissedTrade }: TradeFormProps) {
  const methods = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: trade ? tradeToDefaults(trade) : EMPTY_DEFAULTS,
  });
  const {
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = methods;
  const [error, setError] = useState<string | null>(null);
  const requestClose = useModalGuard(isDirty, onClose);

  async function handleFormSubmit(values: TradeFormValues) {
    setError(null);
    try {
      await onSubmit(values as TradeSubmitInput);
      onClose();
    } catch (err) {
      setError(toErrorMessage(err, "Opslaan van de trade is mislukt"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" onClick={requestClose}>
      <div
        className="w-full max-w-2xl h-full bg-surface border-l border-border overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl italic text-ink">{trade ? "Trade bewerken" : "Nieuwe trade"}</h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-white/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-8">
            <EntrySection />
            <hr className="border-border" />
            <ResultSection allowMissedTrade={allowMissedTrade} />
            <hr className="border-border" />
            <TechnicalSection />

            {error && <p className="text-sm text-loss">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
                Annuleren
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-bg disabled:opacity-60"
              >
                {isSubmitting ? "Bezig..." : trade ? "Opslaan" : "Trade toevoegen"}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
