import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ImagePreviewModal } from "@/components/trades/TradeFormSections/ImagePreviewModal";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { dateLocale, formatResult, numberLocale, resultDisplayValue } from "@/lib/format";
import { hasExplicitRisk, rMultiple } from "@/lib/stats";
import { resolveScreenshotUrl } from "@/lib/storage/screenshots";
import { screenshotSlotLabel } from "@/lib/screenshotSlots";
import { useResultUnit } from "@/hooks/useResultUnit";
import { blockGroupLabel, fieldGroupLabel, fieldLabel } from "@/lib/fieldBlocks";
import { WOVEN_GROUP_KEYS } from "@/components/trades/TradeFormSections/CustomFieldsSection";
import type { ReadOnlyJournalMeta, SharedMethodologyField, Trade } from "@/lib/types";

const SCREENSHOT_KEYS = ["w_screenshot", "d_screenshot", "h4_screenshot", "h2_screenshot"] as const;

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border-soft last:border-0">
      <span className="font-body text-xs text-muted">{label}</span>
      <span className="font-mono text-xs text-ink text-right">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-xs uppercase tracking-wider text-muted mb-1 mt-2">{children}</p>;
}

/**
 * Read-only equivalent of TradeForm — no inputs, no submit, just everything about
 * one trade including screenshots and notes, for the admin debug view and the
 * anonymous share view (Fase M). `fields` (share RPC's methodology_fields slice,
 * 0042) labels the trades.custom values of a config-journal — incl. the former WPM
 * fields (fase/cc/…) since the fase-retirement (0059); without it those values stay
 * hidden rather than showing raw field_keys.
 *
 * `journal` (admin only) switches to the full view: every core column the owner's
 * own form carries (richting, tijden, risico, R:R, MAE/MFE, chart-prijzen), the
 * journal fields per form group and the journal's own screenshot names. The share
 * view deliberately stays on the compact set.
 */
export function ReadOnlyTradeDetailModal({
  trade,
  onClose,
  fields,
  journal,
}: {
  trade: Trade;
  onClose: () => void;
  fields?: SharedMethodologyField[];
  journal?: ReadOnlyJournalMeta;
}) {
  const { t, i18n } = useTranslation();
  const resultUnit = useResultUnit();
  const [previewSrc, setPreviewSrc] = useState<{ src: string; label: string } | null>(null);
  const full = journal !== undefined;
  const fieldDefs = journal?.fields ?? fields ?? [];

  const fmtDate = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtNum = (n: number | null) => (n === null ? null : n.toLocaleString(numberLocale(i18n.language), { maximumFractionDigits: 6 }));

  // Screenshot names: the journal's own slot names in the full view, neutral 1-4 otherwise.
  const defaultSlotNames = journal?.isWpm
    ? [t("tradeForm.weeklyScreenshot"), t("tradeForm.dailyScreenshot"), t("tradeForm.h4Screenshot"), t("tradeForm.h2Screenshot")]
    : full
      ? [t("tradeForm.screenshot1"), t("tradeForm.screenshot2"), t("tradeForm.screenshot3"), t("tradeForm.screenshot4")]
      : ["1", "2", "3", "4"];
  const screenshots = SCREENSHOT_KEYS.map((key, i) => ({
    key,
    value: trade[key],
    label: screenshotSlotLabel(journal?.screenshotLabels, journal?.screenshotTimeframes, defaultSlotNames, i),
  })).filter((s) => s.value);

  // Custom-veld-rijen (Scope C journals): only fields with a filled value in the
  // trade's custom bag. Computed fields are never stored in the bag, so they
  // fall out naturally; sort_order matches the owner's own form order.
  const customRows = fieldDefs
    .filter((f) => {
      const raw = trade.custom?.[f.field_key];
      return raw !== null && raw !== undefined && raw !== "";
    })
    .map((f) => {
      const raw = trade.custom[f.field_key];
      let value: string;
      if (f.field_type === "boolean") value = raw ? t("common.yes") : t("common.no");
      else if (f.field_type === "date") value = fmtDate(String(raw));
      else value = String(raw);
      // field_key is the unique key (labels are free owner text and may repeat).
      // fieldLabel: catalogue-backed labels follow the VIEWER's language (0047).
      return { key: f.field_key, label: fieldLabel(t, f), group: fieldGroupLabel(t, f), groupKey: f.group_key, value };
    });

  // Full view: place the journal fields exactly where the owner's own form puts
  // them. `cc` sits in the Entry grid (EntrySection); the woven Setup/Markt/Mindset
  // fields follow in Technical — for WPM as ONE flat "Setup" block in the journal's
  // own order (TechnicalSection), otherwise per group subheading (CustomFieldGroup);
  // everything else lands under "Extra velden" (CustomFieldsManager).
  const wovenKeys: readonly string[] = WOVEN_GROUP_KEYS;
  const ccRow = customRows.find((r) => r.key === "cc");
  const isWoven = (r: (typeof customRows)[number]) => wovenKeys.includes(r.groupKey ?? "") && r.key !== "cc";
  const bucket = (rows: typeof customRows, labelOf: (r: (typeof customRows)[number]) => string) => {
    const out: { group: string; rows: typeof customRows }[] = [];
    for (const r of rows) {
      const group = labelOf(r);
      const last = out.at(-1);
      if (last && last.group === group) last.rows.push(r);
      else out.push({ group, rows: [r] });
    }
    return out;
  };
  const woven = customRows.filter(isWoven);
  const groupedRows = [
    ...bucket(woven, (r) => (journal?.isWpm ? blockGroupLabel(t, "setup") : (r.group ?? blockGroupLabel(t, "setup")))),
    ...bucket(
      customRows.filter((r) => r.key !== "cc" && !isWoven(r)),
      (r) => r.group ?? t("tradeForm.customSectionHeading")
    ),
  ];

  const hasPrices = [trade.entry_price, trade.stop_price, trade.target_price, trade.exit_price].some((p) => p !== null);

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
                {trade.instrument ?? trade.pair} — {fmtDate(trade.datum_open)}
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

            {full ? (
              <div className="mb-4">
                <SectionHeading>{t("tradeForm.sectionEntry")}</SectionHeading>
                <Row
                  label={t("tradeForm.datumOpen")}
                  value={fmtDate(trade.datum_open) + (trade.tijd_open ? ` ${trade.tijd_open.slice(0, 5)}` : "")}
                />
                {ccRow && <Row label={ccRow.label} value={ccRow.value} />}
                <Row label={t("tradeForm.instrument")} value={trade.instrument ?? trade.pair} />
                <Row label={t("tradeForm.direction")} value={trade.direction ? t(`enums.direction.${trade.direction}`, trade.direction) : null} />
                <Row label={t("filters.sessie")} value={trade.sessie} />
                <Row label={t("tradeForm.datumSluiting")} value={trade.datum_sluiting ? fmtDate(trade.datum_sluiting) : null} />
                <Row label={t("admin.durationDays")} value={trade.duur_dagen} />

                <SectionHeading>{t("tradeForm.sectionResult")}</SectionHeading>
                <Row label={t("admin.plannedRisk")} value={fmtNum(trade.risk_pct)} />
                <Row label={t("tradeForm.plannedRr")} value={fmtNum(trade.planned_rr)} />
                <Row label={t("tradeForm.maePct")} value={fmtNum(trade.mae_pct)} />
                <Row label={t("tradeForm.mfePct")} value={fmtNum(trade.mfe_pct)} />
                <Row
                  label={t("filters.evaluation")}
                  value={trade.trade_evaluation ? t(`enums.evaluation.${trade.trade_evaluation}`, trade.trade_evaluation) : null}
                />

                {hasPrices && (
                  <>
                    <SectionHeading>{t("admin.chartPrices")}</SectionHeading>
                    <Row label={t("admin.entryPrice")} value={fmtNum(trade.entry_price)} />
                    <Row label={t("admin.stopPrice")} value={fmtNum(trade.stop_price)} />
                    <Row label={t("admin.targetPrice")} value={fmtNum(trade.target_price)} />
                    <Row label={t("admin.exitPrice")} value={fmtNum(trade.exit_price)} />
                  </>
                )}

                {groupedRows.map((g) => (
                  <div key={g.group}>
                    <SectionHeading>{g.group}</SectionHeading>
                    {g.rows.map((r) => (
                      <Row key={r.key} label={r.label} value={r.value} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-4">
                {/* Methodology fields (incl. the former WPM fase/cc/concept/… since 0059)
                    come through customRows now; only the universal core stays hardcoded. */}
                <Row label={t("filters.evaluation")} value={trade.trade_evaluation} />
                <Row label={t("filters.sessie")} value={trade.sessie} />
                {customRows.map((r) => (
                  <Row key={r.key} label={r.label} value={r.value} />
                ))}
              </div>
            )}

            {screenshots.length > 0 && (
              <div className="mb-4">
                <p className="font-body text-xs uppercase tracking-wider text-muted mb-2">{t("admin.screenshots")}</p>
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => void openScreenshot(s.value as string, s.label)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-2 text-xs font-body text-ink hover:bg-ink/5"
                    >
                      <Eye size={13} /> {s.label}
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
