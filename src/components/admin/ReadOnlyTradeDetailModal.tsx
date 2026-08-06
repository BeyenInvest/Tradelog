import { useState } from "react";
import { X, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ImagePreviewModal } from "@/components/trades/TradeFormSections/UrlPreviewField";
import { OutcomePill } from "@/components/ui/OutcomePill";
import type { Trade } from "@/lib/types";

const SCREENSHOT_FIELDS: { key: keyof Pick<Trade, "w_screenshot" | "d_screenshot" | "h4_screenshot" | "h2_screenshot">; label: string }[] = [
  { key: "w_screenshot", label: "Weekly" },
  { key: "d_screenshot", label: "Daily" },
  { key: "h4_screenshot", label: "H4" },
  { key: "h2_screenshot", label: "H2" },
];

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border-soft last:border-0">
      <span className="font-body text-xs text-muted">{label}</span>
      <span className="font-mono text-xs text-ink text-right">{value}</span>
    </div>
  );
}

/** Read-only equivalent of TradeForm — no inputs, no submit, just everything about one trade including screenshots and notes, for the admin debug view. */
export function ReadOnlyTradeDetailModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const [previewSrc, setPreviewSrc] = useState<{ src: string; label: string } | null>(null);

  function openScreenshot(url: string, label: string) {
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    setPreviewSrc({ src: href, label });
  }

  return (
    <>
      <Modal labelledBy="trade-detail-title" maxWidthClass="max-w-lg" scroll onClose={onClose}>
        {(requestClose) => (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 id="trade-detail-title" className="font-display text-xl italic text-ink">
                {trade.pair} —{" "}
                {new Date(trade.datum_open + "T00:00:00").toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" })}
              </h2>
              <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <OutcomePill outcome={trade.outcome} />
              <span className={`font-mono text-sm ${trade.resultaat_pct >= 0 ? "text-win" : "text-loss"}`}>
                {trade.resultaat_pct > 0 ? "+" : ""}
                {trade.resultaat_pct}%
              </span>
            </div>

            <div className="mb-4">
              <Row label="Fase" value={trade.fase} />
              <Row label="Evaluatie" value={trade.trade_evaluation} />
              <Row label="CC / Sessie" value={`${trade.cc} · ${trade.sessie}`} />
              <Row label="Trade concept" value={trade.trade_concept} />
              <Row label="Entry" value={trade.entry} />
              <Row label="Weekly criteria" value={trade.weekly_criteria} />
              <Row label="Weekly kenmerk" value={trade.weekly_kenmerk} />
              <Row label="TPFS" value={trade.tpfs_pct != null ? `${trade.tpfs_pct}%` : null} />
              <Row label="Nieuws" value={trade.nieuws ? "Ja" : "Nee"} />
            </div>

            {SCREENSHOT_FIELDS.some((f) => trade[f.key]) && (
              <div className="mb-4">
                <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">Screenshots</p>
                <div className="flex flex-wrap gap-2">
                  {SCREENSHOT_FIELDS.filter((f) => trade[f.key]).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => openScreenshot(trade[f.key] as string, f.label)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-xs font-body text-ink hover:bg-ink/5"
                    >
                      <Eye size={13} /> {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {trade.notes && (
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">Notes</p>
                <p className="font-body text-sm text-ink whitespace-pre-wrap">{trade.notes}</p>
              </div>
            )}
          </>
        )}
      </Modal>

      {previewSrc && <ImagePreviewModal src={previewSrc.src} label={previewSrc.label} onClose={() => setPreviewSrc(null)} />}
    </>
  );
}
