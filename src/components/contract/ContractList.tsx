import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { dateLocale } from "@/lib/format";
import { toErrorMessage } from "@/lib/errorMessage";
import type { TradeContract, TradeContractStatus } from "@/lib/types";
import type { CloseContractInput } from "@/hooks/useTradeContracts";

interface ContractListProps {
  contracts: TradeContract[];
  onClose: (id: string, outcome: CloseContractInput) => Promise<void>;
  onDelete: (contract: TradeContract) => Promise<void>;
}

const STATUS_LABEL_KEY: Record<TradeContractStatus, string> = {
  open: "contract.statusOpen",
  closed: "contract.statusClosed",
  missed: "contract.statusMissed",
};

export function ContractList({ contracts, onClose, onDelete }: ContractListProps) {
  const { t, i18n } = useTranslation();

  if (contracts.length === 0) {
    return <p className="text-sm text-muted">{t("contract.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {contracts.map((c) => (
        <ContractRow key={c.id} contract={c} locale={dateLocale(i18n.language)} onClose={onClose} onDelete={onDelete} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: TradeContractStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={clsx(
        "px-2 py-0.5 rounded-full text-xs font-body",
        status === "missed" ? "bg-loss/15 text-loss" : status === "closed" ? "bg-surface-2 text-muted" : "bg-gold/15 text-gold"
      )}
    >
      {t(STATUS_LABEL_KEY[status])}
    </span>
  );
}

function ContractRow({
  contract,
  locale,
  onClose,
  onDelete,
}: {
  contract: TradeContract;
  locale: string;
  onClose: (id: string, outcome: CloseContractInput) => Promise<void>;
  onDelete: (contract: TradeContract) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [finishing, setFinishing] = useState(false);
  const [outcomeR, setOutcomeR] = useState("");
  const [procesGoed, setProcesGoed] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = new Date(contract.created_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const r = Number(outcomeR);
      await onClose(contract.id, {
        outcome_r: outcomeR.trim() !== "" && Number.isFinite(r) ? r : null,
        proces_goed: procesGoed,
        note: note.trim() || null,
      });
      setFinishing(false);
    } catch (err) {
      setError(toErrorMessage(err, t("contract.saveFailed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card padding="sm" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs text-muted shrink-0">{date}</span>
          <span className="font-body text-sm text-ink truncate">{contract.instrument ?? "—"}</span>
          {contract.fase && <span className="font-mono text-xs text-muted shrink-0">{contract.fase}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={contract.status} />
          {contract.status === "open" && !finishing && (
            <button
              type="button"
              onClick={() => setFinishing(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-body font-medium bg-gold text-on-gold"
            >
              {t("contract.finish")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onDelete(contract)}
            aria-label={t("common.delete")}
            className="p-1.5 rounded-md text-muted hover:text-loss"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Wrapped-up outcome (read-only) for a closed contract. */}
      {contract.status === "closed" && !finishing && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <span>
            {t("contract.outcomeR")}: <span className="font-mono text-ink">{contract.outcome_r ?? "—"}</span>
          </span>
          <span>
            {t("contract.procesQuestion")}{" "}
            <span className={contract.proces_goed ? "text-win" : "text-loss"}>
              {contract.proces_goed === null ? "—" : contract.proces_goed ? t("common.yes") : t("common.no")}
            </span>
          </span>
          {contract.note && <span className="text-ink">{contract.note}</span>}
        </div>
      )}

      {/* Afronden — reveal the outcome inputs. */}
      {finishing && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5 max-w-[8rem]">
              <label className="text-xs uppercase tracking-wider text-muted">{t("contract.outcomeR")}</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={outcomeR}
                onChange={(e) => setOutcomeR(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("contract.procesQuestion")}</label>
              <BooleanToggle value={procesGoed} onChange={setProcesGoed} labels={[t("common.yes"), t("common.no")]} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider text-muted">{t("contract.noteLabel")}</label>
            <input
              type="text"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("contract.notePlaceholder")}
            />
          </div>
          {error && <p className="text-sm text-loss">{error}</p>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFinishing(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting}
              className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
            >
              {submitting ? t("common.submitting") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
