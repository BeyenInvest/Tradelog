import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import type { Trade } from "@/lib/types";
import type { TradeSubmitInput } from "@/hooks/useTrades";
import { useMethodology } from "@/hooks/useMethodology";
import { TradeForm } from "@/components/trades/TradeForm";
import { ReviewTradeGroups, type GroupMode } from "@/components/reviews/ReviewTradeGroups";

interface ReviewTradesPanelProps {
  /** e.g. "Trades in week (3)" — already localised by the caller. */
  label: string;
  taken: Trade[];
  missed: Trade[];
  extraGroupModes?: GroupMode[];
  /** The page's live createTrade; already refreshes trades so this panel's preview updates on save. */
  onAddTrade: (input: TradeSubmitInput) => Promise<void>;
  /** Pre-fills the new trade's date so it lands inside the reviewed period (this week/month/...). */
  initialDate: string;
}

/**
 * The read-only trade breakdown shown at the bottom of both review forms, plus a
 * "Trade toevoegen" affordance: while writing a review you can spot a still-unlogged
 * (missed) trade and add it inline. It opens the same TradeForm the Journal uses —
 * always in the live Journal scope, so "Missed trade" is offered (allowMissedTrade).
 */
export function ReviewTradesPanel({ label, taken, missed, extraGroupModes, onAddTrade, initialDate }: ReviewTradesPanelProps) {
  const { t } = useTranslation();
  const { isLegacyMethodology } = useMethodology();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg p-4 bg-bg border border-border">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-xs uppercase tracking-wider text-muted">{label}</p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-gold hover:text-ink"
          >
            <Plus size={13} /> {t("tradeForm.addTrade")}
          </button>
        </div>
        <ReviewTradeGroups taken={taken} missed={missed} extraGroupModes={extraGroupModes} columnMode={isLegacyMethodology ? "legacy" : "modern"} />
      </div>

      {/* Portalled to <body>: TradeForm renders its own <form>, and the review editors mount this
          panel inside their <form>. Rendering the trade overlay here in-place would nest one form in
          another (invalid HTML — breaks the trade form). The portal lifts it to the top level, the
          same place every other modal in the app lives. */}
      {addOpen &&
        createPortal(
          <TradeForm onSubmit={onAddTrade} onClose={() => setAddOpen(false)} allowMissedTrade initialDate={initialDate} />,
          document.body
        )}
    </>
  );
}
