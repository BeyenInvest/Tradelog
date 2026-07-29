import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { FOREX_PAIRS, currenciesOfPair, type ForexPair } from "@/lib/constants";
import { calculateLotSize, requiresCrossRate, requiresCurrentPrice, pipSizeOf, type AccountCurrency } from "@/lib/lotSize";

const ACCOUNT_CURRENCIES: AccountCurrency[] = ["USD", "EUR"];

const CASE_LABEL: Record<string, string> = {
  direct: "Direct — je accountvaluta is de quote-valuta van deze pair. Geen koers nodig, de pipwaarde staat al vast in je accountvaluta.",
  inverse: "Invers — je accountvaluta is de base-valuta van deze pair, omgerekend via de ingevulde koers.",
  cross: "Cross — je accountvaluta zit niet in deze pair, omgerekend via de extra koers hieronder.",
};

export default function LotSizeCalculatorPage() {
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
    return outcome.errors.find((e) => e.field === field)?.message;
  }

  return (
    <>
      <PageHeader
        title="Lot Size Calculator (Beta)"
        subtitle="Positiegrootte op basis van risico% — jij vult de actuele koers in, niets wordt geraden of live opgehaald"
      />

      <Card className="mb-5 border-gold/40">
        <p className="text-xs text-muted">
          <span className="text-gold font-medium">Beta.</span> Controleer de uitkomst altijd zelf voor je 'm gebruikt om een
          order te plaatsen — vooral bij grote posities. Vragen of iets klopt niet? Meld het voor het verder gebruikt wordt.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="flex flex-col gap-4">
          <h3 className="font-display text-lg italic text-ink">Invoer</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Accountvaluta</label>
              <EnumSelect
                options={ACCOUNT_CURRENCIES}
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value as AccountCurrency)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Pair</label>
              <EnumSelect options={FOREX_PAIRS} value={pair} onChange={(e) => setPair(e.target.value as ForexPair)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-wider text-muted">Account balance ({accountCurrency})</label>
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
              <label className="text-xs uppercase tracking-wider text-muted">Risico %</label>
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
              <label className="text-xs uppercase tracking-wider text-muted">Stop loss (pips)</label>
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
                <label className="text-xs uppercase tracking-wider text-muted">Huidige koers {pair}</label>
                <input
                  type="number"
                  step="0.00001"
                  className="input"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder={quote === "JPY" ? "bv. 150.234" : "bv. 1.09234"}
                />
                {errorFor("currentPrice") && <p className="text-xs text-loss">{errorFor("currentPrice")}</p>}
              </div>
            )}

            {needsCrossRate && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider text-gold">
                  Omrekenkoers — 1 {quote} = ? {accountCurrency}
                </label>
                <input
                  type="number"
                  step="0.00001"
                  className="input"
                  value={quoteToAccountRate}
                  onChange={(e) => setQuoteToAccountRate(e.target.value)}
                  placeholder={`bv. koers van ${quote}${accountCurrency} of het omgekeerde van ${accountCurrency}${quote}`}
                />
                {errorFor("quoteToAccountRate") && <p className="text-xs text-loss">{errorFor("quoteToAccountRate")}</p>}
              </div>
            )}
          </div>

          <p className="font-mono text-[11px] text-faint">
            {pair} · base {base} / quote {quote} · pip size {pipSize}
          </p>
        </Card>

        <Card className="flex flex-col gap-4">
          <h3 className="font-display text-lg italic text-ink">Resultaat</h3>

          {!outcome ? (
            <p className="text-sm text-muted">Vul alle velden in.</p>
          ) : !outcome.ok ? (
            <p className="text-sm text-loss">Corrigeer de gemarkeerde velden hierboven.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-muted">Positiegrootte</p>
                <p className="font-mono text-4xl mt-1 text-gold">{outcome.result.lots} lots</p>
                <p className="font-mono text-sm text-muted mt-1">{outcome.result.units.toLocaleString("nl-BE")} units</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <p className="font-body text-xs uppercase tracking-wider text-muted">Risicobedrag</p>
                  <p className="font-mono text-lg text-ink">
                    {outcome.result.riskAmount.toLocaleString("nl-BE")} {accountCurrency}
                  </p>
                </div>
                <div>
                  <p className="font-body text-xs uppercase tracking-wider text-muted">Pipwaarde / lot</p>
                  <p className="font-mono text-lg text-ink">
                    {outcome.result.pipValuePerLot} {accountCurrency}
                  </p>
                </div>
              </div>

              <p className="font-body text-xs text-muted pt-2 border-t border-border">{CASE_LABEL[outcome.result.conversionCase]}</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
