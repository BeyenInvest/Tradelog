import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { FOREX_PAIRS, currenciesOfPair, type ForexPair } from "@/lib/constants";
import { calculateLotSize, requiresCrossRate, requiresCurrentPrice, pipSizeOf, type AccountCurrency } from "@/lib/lotSize";

const ACCOUNT_CURRENCIES: AccountCurrency[] = ["USD", "EUR"];

/** conversionCase → i18n key describing why (or why not) a conversion rate is needed. */
const CASE_LABEL_KEY: Record<string, string> = {
  direct: "lotSize.caseDirect",
  inverse: "lotSize.caseInverse",
  cross: "lotSize.caseCross",
};

export default function LotSizeCalculatorPage() {
  const { t } = useTranslation();
  const [accountCurrency, setAccountCurrency] = useState<AccountCurrency>("USD");
  const [pair, setPair] = useState<ForexPair>("EURUSD");
  const [accountBalance, setAccountBalance] = useState("");
  const [riskPercent, setRiskPercent] = useState("1");
  const [stopLossPips, setStopLossPips] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [quoteToAccountRate, setQuoteToAccountRate] = useState("");

  const [base, quote] = currenciesOfPair(pair);
  const needsCrossRate = requiresCrossRate(pair, accountCurrency);
  const needsCurrentPrice = requiresCurrentPrice(pair, accountCurrency);
  const pipSize = pipSizeOf(pair);

  const allFilled =
    accountBalance !== "" &&
    riskPercent !== "" &&
    stopLossPips !== "" &&
    (!needsCurrentPrice || currentPrice !== "") &&
    (!needsCrossRate || quoteToAccountRate !== "");

  const outcome = useMemo(() => {
    if (!allFilled) return null;
    return calculateLotSize({
      accountCurrency,
      accountBalance: Number(accountBalance),
      riskPercent: Number(riskPercent),
      stopLossPips: Number(stopLossPips),
      pair,
      currentPrice: needsCurrentPrice ? Number(currentPrice) : undefined,
      quoteToAccountRate: needsCrossRate ? Number(quoteToAccountRate) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, accountCurrency, accountBalance, riskPercent, stopLossPips, pair, currentPrice, quoteToAccountRate, needsCrossRate, needsCurrentPrice]);

  function errorFor(field: string): string | undefined {
    if (!outcome || outcome.ok) return undefined;
    const err = outcome.errors.find((e) => e.field === field);
    if (!err) return undefined;
    return err.code === "mustBePositive" ? t("lotSize.errMustBePositive") : t("lotSize.errRequiredForCombo");
  }

  return (
    <>
      <PageHeader title={t("nav.lotSize")} subtitle={t("lotSize.subtitle")} />

      <Card className="mb-5 border-gold/40">
        <p className="text-xs text-muted">
          <span className="text-gold font-medium">{t("lotSize.betaLabel")}</span> {t("lotSize.betaWarning")}
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="flex flex-col gap-4">
          <h3 className="font-display text-lg italic text-ink">{t("lotSize.inputHeading")}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.accountCurrency")}</label>
              <EnumSelect
                options={ACCOUNT_CURRENCIES}
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value as AccountCurrency)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.pair")}</label>
              <EnumSelect options={FOREX_PAIRS} value={pair} onChange={(e) => setPair(e.target.value as ForexPair)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.accountBalance", { currency: accountCurrency })}</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
              />
              {errorFor("accountBalance") && <p className="text-xs text-loss">{errorFor("accountBalance")}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.riskPercent")}</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={riskPercent}
                onChange={(e) => setRiskPercent(e.target.value)}
              />
              {errorFor("riskPercent") && <p className="text-xs text-loss">{errorFor("riskPercent")}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.stopLossPips")}</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={stopLossPips}
                onChange={(e) => setStopLossPips(e.target.value)}
              />
              {errorFor("stopLossPips") && <p className="text-xs text-loss">{errorFor("stopLossPips")}</p>}
            </div>
            {needsCurrentPrice && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider text-muted">{t("lotSize.currentPrice", { pair })}</label>
                <input
                  type="number"
                  step="0.00001"
                  className="input"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder={quote === "JPY" ? t("lotSize.currentPricePlaceholderJpy") : t("lotSize.currentPricePlaceholder")}
                />
                {errorFor("currentPrice") && <p className="text-xs text-loss">{errorFor("currentPrice")}</p>}
              </div>
            )}

            {needsCrossRate && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider text-gold">
                  {t("lotSize.crossRateLabel", { quote, currency: accountCurrency })}
                </label>
                <input
                  type="number"
                  step="0.00001"
                  className="input"
                  value={quoteToAccountRate}
                  onChange={(e) => setQuoteToAccountRate(e.target.value)}
                  placeholder={t("lotSize.crossRatePlaceholder", { quote, currency: accountCurrency })}
                />
                {errorFor("quoteToAccountRate") && <p className="text-xs text-loss">{errorFor("quoteToAccountRate")}</p>}
              </div>
            )}
          </div>

          <p className="font-mono text-[11px] text-faint">
            {t("lotSize.meta", { pair, base, quote, pipSize })}
          </p>
        </Card>

        <Card className="flex flex-col gap-4">
          <h3 className="font-display text-lg italic text-ink">{t("lotSize.resultHeading")}</h3>

          {!outcome ? (
            <p className="text-sm text-muted">{t("lotSize.fillAll")}</p>
          ) : !outcome.ok ? (
            <p className="text-sm text-loss">{t("lotSize.fixErrors")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-muted">{t("lotSize.positionSize")}</p>
                <p className="font-mono text-4xl mt-1 text-gold">{outcome.result.lots} {t("lotSize.lotsUnit")}</p>
                <p className="font-mono text-sm text-muted mt-1">{outcome.result.units.toLocaleString("nl-BE")} {t("lotSize.unitsUnit")}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="font-body text-xs uppercase tracking-wider text-muted">{t("lotSize.riskAmount")}</p>
                  <p className="font-mono text-lg text-ink">
                    {outcome.result.riskAmount.toLocaleString("nl-BE")} {accountCurrency}
                  </p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wider text-muted">{t("lotSize.pipValuePerLot")}</p>
                  <p className="font-mono text-lg text-ink">
                    {outcome.result.pipValuePerLot} {accountCurrency}
                  </p>
                </div>
              </div>

              <p className="font-body text-xs text-muted pt-2 border-t border-border">{t(CASE_LABEL_KEY[outcome.result.conversionCase])}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
