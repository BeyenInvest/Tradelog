import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ContractForm } from "@/components/contract/ContractForm";
import { ContractList } from "@/components/contract/ContractList";
import { useTradeContracts } from "@/hooks/useTradeContracts";
import { useConfirm } from "@/hooks/useConfirm";
import { isoWeekOf, isoWeekRange } from "@/lib/isoWeek";
import { localTodayIso } from "@/lib/localDate";
import type { TradeContract } from "@/lib/types";

export default function ContractPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirm();
  const { contracts, loading, error, signContract, closeContract, markMissed, deleteContract } = useTradeContracts();

  // "This week" is the current ISO week — signed_at (signed contracts) / created_at (missed) fall inside it.
  const stats = useMemo(() => {
    const { jaar, week_nummer } = isoWeekOf(localTodayIso());
    const { start, end } = isoWeekRange(jaar, week_nummer);
    const inWeek = (iso: string | null) => iso != null && iso.slice(0, 10) >= start && iso.slice(0, 10) <= end;

    const signedWeek = contracts.filter((c) => c.status !== "missed" && inWeek(c.signed_at)).length;
    const missedWeek = contracts.filter((c) => c.status === "missed" && inWeek(c.created_at)).length;
    // Process respected across every wrapped-up contract (all-time ratio).
    const closed = contracts.filter((c) => c.status === "closed" && c.proces_goed !== null);
    const procesOk = closed.filter((c) => c.proces_goed === true).length;
    return { signedWeek, missedWeek, procesOk, procesTotal: closed.length };
  }, [contracts]);

  async function handleDelete(contract: TradeContract) {
    const ok = await confirm({
      title: t("common.deleteTitle"),
      message: t("contract.deleteConfirm"),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    await deleteContract(contract.id);
  }

  return (
    <>
      {confirmDialog}
      <PageHeader title={t("contract.title")} subtitle={t("contract.subtitle")} />

      {error && <p className="text-sm text-loss mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label={t("contract.statSigned")} value={stats.signedWeek} compact />
        <StatCard label={t("contract.statMissed")} value={stats.missedWeek} tone={stats.missedWeek > 0 ? "down" : "neutral"} compact />
        <StatCard label={t("contract.statProces")} value={`${stats.procesOk}/${stats.procesTotal}`} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContractForm
          onSign={async (input) => {
            await signContract(input);
          }}
          onMissed={async (input) => {
            await markMissed(input);
          }}
        />
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl italic text-ink">{t("contract.journalTitle")}</h2>
          {loading ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : (
            <ContractList
              contracts={contracts}
              onClose={async (id, outcome) => {
                await closeContract(id, outcome);
              }}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </>
  );
}
