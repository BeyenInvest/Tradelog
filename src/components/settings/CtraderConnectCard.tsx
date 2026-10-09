import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useJournals } from "@/hooks/useJournals";
import { useConfirm } from "@/hooks/useConfirm";
import { toErrorMessage } from "@/lib/errorMessage";
import { BROKER_ACCOUNT_COLUMNS, CtraderRequestError, ctraderApi, type BrokerAccount } from "@/lib/ctrader";

type Flash = "connected" | "denied" | "noaccounts" | "error";
const FLASH_KEY: Record<Flash, string> = {
  connected: "ctrader.flashConnected",
  denied: "ctrader.flashDenied",
  noaccounts: "ctrader.flashNoAccounts",
  error: "ctrader.flashError",
};

/**
 * cTrader-koppeling (docs/plan-ctrader-sync.md §4). Start de OAuth-flow via
 * api/ctrader.ts?action=start, toont na de callback (/settings?ctrader=…) de
 * gekoppelde accounts en laat per account het doel-journal en de startdatum
 * kiezen. Een journal kiezen = automatisch importeren aan; "geen" = uit (de
 * `enabled`-kolom volgt de keuze, geen aparte schakelaar). De tokens zelf zijn nooit client-side zichtbaar.
 * Beta-gated (gating-regel) — de SettingsPage rendert dit alleen voor betaFeatures.
 */
export function CtraderConnectCard() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { journals } = useJournals();
  const { confirm, confirmDialog } = useConfirm();
  const [params, setParams] = useSearchParams();
  const userId = session?.user.id ?? null;

  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: loadError } = await supabase
      .from("broker_accounts")
      .select(BROKER_ACCOUNT_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (loadError) setError(toErrorMessage(loadError, t("ctrader.errorGeneric")));
    else setAccounts((data ?? []));
  }, [userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Terugkeer uit de OAuth-callback: melding tonen en de query-param opruimen.
  useEffect(() => {
    const value = params.get("ctrader");
    if (!value) return;
    if (value in FLASH_KEY) setFlash(value as Flash);
    const next = new URLSearchParams(params);
    next.delete("ctrader");
    setParams(next, { replace: true });
  }, [params, setParams]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await ctraderApi.start();
      window.location.assign(url);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof CtraderRequestError && err.status === 403 ? t("ctrader.errorBeta") : t("ctrader.errorGeneric")
      );
    }
  }

  async function patch(account: BrokerAccount, values: Partial<Pick<BrokerAccount, "methodology_id" | "enabled" | "synced_until">>) {
    setError(null);
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, ...values } : a)));
    const { error: updateError } = await supabase.from("broker_accounts").update(values).eq("id", account.id);
    if (updateError) {
      setError(toErrorMessage(updateError, t("ctrader.errorGeneric")));
      void load();
    }
  }

  async function handleDisconnect(connectionId: string) {
    const ok = await confirm({
      title: t("ctrader.disconnect"),
      message: t("ctrader.disconnectConfirm"),
      tone: "danger",
      confirmLabel: t("ctrader.disconnect"),
    });
    if (!ok) return;
    setBusy(true);
    try {
      await ctraderApi.disconnect(connectionId);
      await load();
    } catch {
      setError(t("ctrader.errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const connectionIds = [...new Set(accounts.map((a) => a.connection_id))];

  return (
    <Card>
      <p className="font-body text-sm text-ink">{t("ctrader.title")}</p>
      <p className="font-mono text-xs mt-1 text-muted">{t("ctrader.description")}</p>

      {flash && (
        <p className={`font-mono text-[11px] mt-3 ${flash === "connected" ? "text-win" : "text-loss"}`}>
          {t(FLASH_KEY[flash])}
        </p>
      )}

      {accounts.length === 0 ? (
        <ol className="list-decimal pl-5 mt-3 flex flex-col gap-1 font-body text-xs text-muted">
          <li>{t("ctrader.step1")}</li>
          <li>{t("ctrader.step2")}</li>
          <li>{t("ctrader.step3")}</li>
        </ol>
      ) : (
        <div className="flex flex-col gap-3 mt-3">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-lg border border-border-soft p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span
                  className={`px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wider ${
                    a.is_live ? "border-gold/50 text-gold" : "border-border text-muted"
                  }`}
                >
                  {a.is_live ? t("ctrader.live") : t("ctrader.demo")}
                </span>
                <span className="text-ink">{a.account_login ?? a.external_account_id}</span>
                {a.broker_name && <span className="text-muted">· {a.broker_name}</span>}
              </div>

              <label className="flex items-center justify-between gap-3 font-body text-xs text-muted">
                {t("ctrader.journal")}
                <select
                  value={a.enabled ? (a.methodology_id ?? "") : ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    void patch(a, { methodology_id: id, enabled: id != null });
                  }}
                  className="input text-xs py-1.5 max-w-[60%]"
                >
                  <option value="">{t("ctrader.noJournal")}</option>
                  {journals.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.naam}
                    </option>
                  ))}
                </select>
              </label>

              <p className={`font-mono text-[11px] ${a.enabled && a.methodology_id ? "text-win" : "text-faint"}`}>
                {a.enabled && a.methodology_id
                  ? t("ctrader.statusOn", { journal: journals.find((j) => j.id === a.methodology_id)?.naam ?? "" })
                  : t("ctrader.statusOff")}
              </p>

              {a.last_synced_at == null ? (
                <label className="flex flex-col gap-1 font-body text-xs text-muted">
                  <span className="flex items-center justify-between gap-3">
                    {t("ctrader.since")}
                    <input
                      type="date"
                      value={a.synced_until.slice(0, 10)}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        if (e.target.value) void patch(a, { synced_until: new Date(`${e.target.value}T00:00:00`).toISOString() });
                      }}
                      className="input text-xs py-1.5"
                    />
                  </span>
                  <span className="font-mono text-[11px] text-faint">{t("ctrader.sinceHint")}</span>
                </label>
              ) : (
                <p className="font-mono text-[11px] text-faint">
                  {t("ctrader.lastSync", {
                    when: new Date(a.last_synced_at).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" }),
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={busy}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? t("ctrader.connecting") : accounts.length > 0 ? t("ctrader.reconnect") : t("ctrader.connect")}
        </button>
        {connectionIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => void handleDisconnect(id)}
            disabled={busy}
            className="px-4 py-2 rounded-lg font-body text-sm border border-border text-muted hover:text-loss hover:border-loss/50 disabled:opacity-40"
          >
            {t("ctrader.disconnect")}
          </button>
        ))}
      </div>

      {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
      {confirmDialog}
    </Card>
  );
}
