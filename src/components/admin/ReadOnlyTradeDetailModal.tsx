import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ImagePreviewModal } from "@/components/trades/TradeFormSections/UrlPreviewField";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { dateLocale, formatResult, resultDisplayValue } from "@/lib/format";
import { hasExplicitRisk, rMultiple } from "@/lib/stats";
import { resolveScreenshotUrl } from "@/lib/storage/screenshots";
import { useResultUnit } from "@/hooks/useResultUnit";
import { fieldLabel } from "@/lib/fieldBlocks";
import type { SharedMethodologyField, Trade } from "@/lib/types";

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

/**
 * Read-only equivalent of TradeForm — no inputs, no submit, just everything about
 * one trade including screenshots and notes, for the admin debug view and the
 * anonymous share view (Fase M). `hideFase` honours the owner's hide_fase setting
 * on surfaces where the viewer has no useAuth profile of their own (the share view).
 * `fields` (share RPC's methodology_fields slice, 0042) labels the trades.custom
 * values of a config-journal; without it those values stay hidden rather than
 * showing raw field_keys.
 */
export function ReadOnlyTradeDetailModal({
  trade,
  onClose,
  hideFase = false,
  fields,
}: {
  trade: Trade;
  onClose: () => void;
  hideFase?: boolean;
  fields?: SharedMethodologyField[];
}) {
  const { t, i18n } = useTranslation();
  const resultUnit = useResultUnit();
  const [previewSrc, setPreviewSrc] = useState<{ src: string; label: string } | null>(null);
  const screenshotFields = SCREENSHOT_FIELDS.filter((f) => trade[f.key]);

  // Custom-veld-rijen (Scope C journals): only fields with a filled value in the
  // trade's custom bag. Computed fields are never stored in the bag, so they
  // fall out naturally; sort_order matches the owner's own form order.
  const customRows = (fields ?? [])
    .filter((f) => {
      const raw = trade.custom?.[f.field_key];
      return raw !== null && raw !== undefined && raw !== "";
    })
    .map((f) => {
      const raw = trade.custom[f.field_key];
      let value: string;
      if (f.field_type === "boolean") value = raw ? t("common.yes") : t("common.no");
      else if (f.field_type === "date")
        value = new Date(String(raw) + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "numeric" });
      else value = String(raw);
      // field_key is the unique key (labels are free owner text and may repeat).
      // fieldLabel: catalogue-backed labels follow the VIEWER's language (0047).
      return { key: f.field_key, label: fieldLabel(t, f), value };
    });

  // A screenshot value is either an external URL or a private-bucket path (Fase K);
  // resolveScreenshotUrl mints a signed URL for the latter and passes URLs through.
  async function openScreenshot(value: string, label: string) {
    const src = await resolveScreenshotUrl(value);
    if (src) setPreviewSrc({ src, label });
  }

  return (
    <>
      <Modal labelledBy="trade-detail-title" maxWidthClass="max-w-lg" scroll onClose={onClose}>
        {(requestClose) => (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 id="trade-detail-title" className="font-display text-xl italic text-ink">
                {trade.instrument ?? trade.pair} —{" "}
                {new Date(trade.datum_open + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "numeric" })}
              </h2>
              <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {trade.is_open ? (
                <span className="font-mono text-sm text-gold">{t("tradeBadge.open")}</span>
              ) : (
                <>
                  <OutcomePill outcome={trade.outcome!} />
                  <span
                    className={`font-mono text-sm ${
                      resultDisplayValue(trade.resultaat_pct!, resultUnit, { rMultiple: rMultiple({ resultaat_pct: trade.resultaat_pct!, risk_pct: trade.risk_pct }) }) >= 0
                        ? "text-win"
                        : "text-loss"
                    }`}
                  >
                    {formatResult(trade.resultaat_pct!, resultUnit, {
                      rMultiple: rMultiple({ resultaat_pct: trade.resultaat_pct!, risk_pct: trade.risk_pct }),
                      rAssumed: !hasExplicitRisk(trade),
                    })}
                  </span>
                </>
              )}
            </div>

            <div className="mb-4">
              {!hideFase && <Row label={t("filters.fase")} value={trade.fase} />}
              <Row label={t("filters.evaluation")} value={trade.trade_evaluation} />
              <Row label={t("admin.ccSessie")} value={`${trade.cc} · ${trade.sessie}`} />
              <Row label={t("tradeForm.tradeConcept")} value={trade.trade_concept} />
              <Row label={t("tradeForm.entry")} value={trade.entry} />
              <Row label={t("tradeForm.weeklyCriteria")} value={trade.weekly_criteria} />
              <Row label={t("tradeForm.weeklyKenmerk")} value={trade.weekly_kenmerk} />
              <Row label={t("filters.news")} value={trade.nieuws ? t("common.yes") : t("common.no")} />
              {customRows.map((r) => (
                <Row key={r.key} label={r.label} value={r.value} />
              ))}
            </div>

            {screenshotFields.length > 0 && (
              <div className="mb-4">
                <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">{t("admin.screenshots")}</p>
                <div className="flex flex-wrap gap-2">
                  {screenshotFields.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => void openScreenshot(trade[f.key] as string, f.label)}
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
                <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">{t("tradeForm.notes")}</p>
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
