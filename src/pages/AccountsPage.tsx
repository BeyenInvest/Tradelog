import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePropAccounts } from "@/hooks/usePropAccounts";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountList } from "@/components/accounts/AccountList";

export default function AccountsPage() {
  const { t } = useTranslation();
  const { accounts, payouts, loading, error, createAccount, updateAccount, deleteAccount, createPayout, deletePayout } = usePropAccounts();

  return (
    <>
      <PageHeader title={t("nav.accounts")} subtitle={t("accounts.subtitle")} />
      {error && <p className="text-sm text-loss mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted text-sm">{t("common.loading")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <AccountForm onSubmit={createAccount} />
          <AccountList
            accounts={accounts}
            payouts={payouts}
            onDeleteAccount={deleteAccount}
            onUpdateAccount={updateAccount}
            onCreatePayout={createPayout}
            onDeletePayout={deletePayout}
          />
        </div>
      )}
    </>
  );
}
