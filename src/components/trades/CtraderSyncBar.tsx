import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { CtraderSyncState } from "@/hooks/useCtraderSync";

interface CtraderSyncBarProps {
  sync: CtraderSyncState;
  /** Opent de import-wizard met de pending posities (symbool-koppeling). */
  onResolve: () => void;
}

/**
 * Compacte statusregel boven het journal zodra er een cTrader-account aan dít
 * journal hangt: laatste sync, resultaat, handmatige sync en de "wacht op
 * symbool-koppeling"-uitweg. Rendert niets zonder gekoppeld account.
 */
export function CtraderSyncBar({ sync, onResolve }: CtraderSyncBarProps) {
  const { t, i18n } = useTranslation();
  if (sync.accounts.length === 0) return null;

  const when = sync.lastSyncedAt
    ? new Date(sync.lastSyncedAt).toLocaleString(i18n.language, { dateStyle: "short", timeStyle: "short" })
    : t("ctrader.never");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-soft bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
      <span className="text-ink">{t("ctrader.bar")}</span>
      <span>
        {sync.syncing
          ? t("ctrader.syncing")
          : sync.importedCount != null && sync.importedCount > 0
            ? t("ctrader.imported", { count: sync.importedCount })
            : sync.importedCount === 0
              ? t("ctrader.upToDate")
              : t("ctrader.lastSync", { when })}
      </span>
      {sync.error && <span className="text-loss">{t("ctrader.syncFailed", { message: sync.error })}</span>}
      {sync.pending && (
        <span className="flex items-center gap-2 text-ink">
          {t("ctrader.pending", { count: sync.pending.blockedCount })}
          <button type="button" onClick={onResolve} className="text-gold underline-offset-2 hover:underline">
            {t("ctrader.resolve")}
          </button>
          <button
            type="button"
            onClick={() => void sync.ignorePending()}
            className="text-muted underline-offset-2 hover:underline hover:text-ink"
          >
            {t("ctrader.ignore")}
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={() => void sync.syncNow()}
        disabled={sync.syncing}
        title={t("ctrader.syncNow")}
        aria-label={t("ctrader.syncNow")}
        className="ml-auto p-1 rounded hover:bg-ink/5 hover:text-ink disabled:opacity-40"
      >
        <RefreshCw size={14} className={sync.syncing ? "animate-spin" : undefined} />
      </button>
    </div>
  );
}
