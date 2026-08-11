import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, X, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { OutcomePill } from "@/components/ui/OutcomePill";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { PAIRS, type Pair } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errorMessage";
import { detectBroker, parseFile, prepareImport, type ImportBroker, type ParsedDeal } from "@/lib/import";
import type { TradesApi } from "@/hooks/useTrades";

const PAIR_MAP_STORAGE_KEY = "beyen.import.pairMap";
const PREVIEW_LIMIT = 8;
const BROKERS: ImportBroker[] = ["ctrader", "mt"];

function loadStoredPairMap(): Record<string, Pair> {
  try {
    const raw = localStorage.getItem(PAIR_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const valid: Record<string, Pair> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if ((PAIRS as readonly string[]).includes(v)) valid[k] = v as Pair;
    }
    return valid;
  } catch {
    return {};
  }
}

interface ImportModalProps {
  tradesApi: TradesApi;
  onClose: () => void;
}

/**
 * Broker-CSV import wizard. Pick a MetaTrader/cTrader export → the deals are
 * parsed and planned (prepareImport) → the user maps any unknown symbols and,
 * if the export lacks per-trade %/balance, enters an account balance → confirm
 * bulk-inserts. Re-importing the same file is a no-op (import_ref dedup). Every
 * imported trade lands in the live Journal as a *taken* trade (never "Missed").
 */
export function ImportModal({ tradesApi, onClose }: ImportModalProps) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isForexJournal } = useMethodology();
  const userId = session!.user.id;

  const [rawText, setRawText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [broker, setBroker] = useState<ImportBroker>("ctrader");
  const [deals, setDeals] = useState<ParsedDeal[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [existingRefs, setExistingRefs] = useState<Set<string>>(new Set());
  const [pairMap, setPairMap] = useState<Record<string, Pair>>(loadStoredPairMap);
  const [balanceInput, setBalanceInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  const accountBalance = balanceInput.trim() === "" ? null : Number(balanceInput);

  // Existing import refs for dedup — fetched once when the modal opens.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trades")
      .select("import_ref")
      .eq("user_id", userId)
      .not("import_ref", "is", null)
      .then(({ data }) => {
        if (cancelled) return;
        setExistingRefs(new Set((data ?? []).map((r) => (r as { import_ref: string }).import_ref)));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const prepared = useMemo(
    () =>
      prepareImport(deals, broker, {
        pairMap,
        accountBalance: accountBalance != null && Number.isFinite(accountBalance) ? accountBalance : null,
        existingImportRefs: existingRefs,
        forexJournal: isForexJournal,
      }),
    [deals, broker, pairMap, accountBalance, existingRefs, isForexJournal]
  );

  function parseText(text: string, b: ImportBroker) {
    try {
      const result = parseFile(text, b);
      setDeals(result.deals);
      setParseError(result.deals.length === 0 ? t("import.noDeals") : null);
    } catch (err) {
      setDeals([]);
      setParseError(toErrorMessage(err, t("import.parseFailed")));
    }
  }

  async function handleFile(file: File) {
    setParseError(null);
    setDoneCount(null);
    setImportError(null);
    const text = await file.text();
    const b = detectBroker(text, file.name);
    setRawText(text);
    setFileName(file.name);
    setBroker(b);
    parseText(text, b);
  }

  function changeBroker(b: ImportBroker) {
    setBroker(b);
    if (rawText != null) parseText(rawText, b);
  }

  function mapSymbol(symbol: string, pair: string) {
    setPairMap((prev) => {
      const next = { ...prev };
      if (pair === "") delete next[symbol];
      else next[symbol] = pair as Pair;
      try {
        localStorage.setItem(PAIR_MAP_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota/availability errors — mapping still works this session */
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (prepared.rows.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const count = await tradesApi.createTradesBulk(prepared.rows);
      setDoneCount(count);
    } catch (err) {
      setImportError(toErrorMessage(err, t("import.importFailed")));
    } finally {
      setImporting(false);
    }
  }

  const skippedTotal = prepared.undatedCount + prepared.unknownSymbols.length;

  return (
    <Modal labelledBy="import-title" maxWidthClass="max-w-3xl" scroll onClose={onClose}>
      {(requestClose) => (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="import-title" className="font-display text-2xl italic text-ink">
                {t("import.title")}
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-gold/50 text-gold">
                Beta
              </span>
            </div>
            <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
              <X size={18} />
            </button>
          </div>

          {doneCount != null ? (
            <div className="flex flex-col gap-4 py-4">
              <p className="text-sm text-win">{t("import.done", { count: doneCount })}</p>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
                >
                  {t("common.close")}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-body text-sm text-muted">{t("import.intro")}</p>

              {/* File picker + broker */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm bg-surface-2 text-ink hover:bg-ink/5 cursor-pointer">
                  <Upload size={15} />
                  {t("import.chooseFile")}
                  <input
                    type="file"
                    accept=".csv,.txt,.htm,.html,text/csv,text/html"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleFile(f);
                    }}
                  />
                </label>
                {fileName && (
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted">
                    <FileText size={13} /> {fileName}
                  </span>
                )}
                {rawText != null && (
                  <label className="sm:ml-auto flex items-center gap-2 font-body text-xs text-muted">
                    {t("import.reparse")}
                    <select
                      value={broker}
                      onChange={(e) => changeBroker(e.target.value as ImportBroker)}
                      className="input text-xs py-1.5"
                    >
                      {BROKERS.map((b) => (
                        <option key={b} value={b}>
                          {t(b === "mt" ? "import.brokerMt" : "import.brokerCtrader")}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {parseError && <p className="text-sm text-loss">{parseError}</p>}

              {deals.length > 0 && (
                <>
                  {/* Summary line */}
                  <p className="font-mono text-xs text-muted">
                    <span className="text-ink">{t("import.summaryReady", { count: prepared.rows.length })}</span>
                    {prepared.duplicateCount > 0 && <> · {t("import.summaryDupes", { count: prepared.duplicateCount })}</>}
                    {skippedTotal > 0 && <> · {t("import.summarySkipped", { count: skippedTotal })}</>}
                  </p>

                  {/* Unknown symbol mapping */}
                  {prepared.unknownSymbols.length > 0 && (
                    <div className="rounded-lg border border-border-soft p-3 flex flex-col gap-2">
                      <p className="font-body text-sm text-ink">{t("import.unknownTitle")}</p>
                      <p className="font-body text-xs text-muted">{t("import.unknownHint")}</p>
                      <div className="flex flex-col gap-2 mt-1">
                        {prepared.unknownSymbols.map((sym) => (
                          <div key={sym} className="flex items-center gap-3">
                            <span className="font-mono text-xs text-ink w-32 truncate">{sym}</span>
                            <select
                              value={pairMap[sym] ?? ""}
                              onChange={(e) => mapSymbol(sym, e.target.value)}
                              className="input text-xs py-1.5"
                            >
                              <option value="">{t("import.mapPlaceholder")}</option>
                              {PAIRS.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Account balance fallback */}
                  {prepared.needsBalance && (
                    <div className="rounded-lg border border-gold/40 p-3 flex flex-col gap-2">
                      <p className="font-body text-sm text-ink">{t("import.balanceTitle")}</p>
                      <p className="font-body text-xs text-muted">{t("import.balanceHint")}</p>
                      <label className="flex items-center gap-2 font-body text-xs text-muted mt-1">
                        {t("import.balanceLabel")}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={balanceInput}
                          onChange={(e) => setBalanceInput(e.target.value)}
                          className="input text-xs py-1.5 w-40"
                        />
                      </label>
                    </div>
                  )}

                  {/* Preview */}
                  {prepared.rows.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="font-body text-xs uppercase tracking-wider text-muted">{t("import.previewTitle")}</p>
                      <div className="overflow-x-auto">
                        <div className="min-w-[420px] flex flex-col gap-1">
                          <div className="grid grid-cols-4 gap-3 font-body text-[11px] uppercase tracking-wider text-faint pb-1 border-b border-border-soft">
                            <span>{t("import.colDate")}</span>
                            <span>{t(isForexJournal ? "import.colPair" : "import.colInstrument")}</span>
                            <span>{t("import.colOutcome")}</span>
                            <span className="text-right">{t("import.colResult")}</span>
                          </div>
                          {prepared.rows.slice(0, PREVIEW_LIMIT).map((r) => (
                            <div key={r.import_ref} className="grid grid-cols-4 gap-3 font-mono text-xs items-center py-1">
                              <span className="text-muted">{r.datum_open}</span>
                              <span className="text-ink">{r.instrument ?? r.pair}</span>
                              <span>
                                <OutcomePill outcome={r.outcome} />
                              </span>
                              <span
                                className={`text-right ${
                                  r.resultaat_pct > 0 ? "text-win" : r.resultaat_pct < 0 ? "text-loss" : "text-be"
                                }`}
                              >
                                {r.resultaat_pct > 0 ? "+" : ""}
                                {r.resultaat_pct}%
                              </span>
                            </div>
                          ))}
                          {prepared.rows.length > PREVIEW_LIMIT && (
                            <p className="font-body text-xs text-faint pt-1">
                              {t("import.morePreview", { count: prepared.rows.length - PREVIEW_LIMIT })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {importError && <p className="text-sm text-loss">{importError}</p>}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={requestClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
                      {t("common.cancel")}
                    </button>
                    <button
                      onClick={() => void handleConfirm()}
                      disabled={importing || prepared.rows.length === 0}
                      className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-50"
                    >
                      {importing
                        ? t("import.importing")
                        : prepared.rows.length === 0
                          ? t("import.nothingReady")
                          : t("import.confirm", { count: prepared.rows.length })}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
