import { useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { FileSignature } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { toErrorMessage } from "@/lib/errorMessage";
import type { SignContractInput } from "@/hooks/useTradeContracts";

interface ContractFormProps {
  onSign: (input: SignContractInput) => Promise<void>;
  onMissed: (input: SignContractInput) => Promise<void>;
}

type Message = { tone: "refusal" | "prompt" | "success"; text: string } | null;

const FASES = ["F2", "F3"] as const;

/**
 * The pre-trade signing form. Poort 0 (keystone) is the hard gate: any unchecked
 * keystone box is a refusal, never a save. Modus B (the "twijfel" button) confronts
 * the owner and offers signing anyway or a deliberate skip (a broken keystone → 'missed').
 */
export function ContractForm({ onSign, onMissed }: ContractFormProps) {
  const { t } = useTranslation();

  // Poort 0 — keystone (all three required to sign).
  const [kWatchlist, setKWatchlist] = useState(false);
  const [kContext, setKContext] = useState(false);
  const [kPlan, setKPlan] = useState(false);
  // Fase + instrument.
  const [fase, setFase] = useState<(typeof FASES)[number]>("F2");
  const [instrument, setInstrument] = useState("");
  // Poort 3 — risk.
  const [riskPct, setRiskPct] = useState("1");
  const [riskSl, setRiskSl] = useState(false);
  const [riskInvalidation, setRiskInvalidation] = useState(false);
  // Poort 4 — nieuws.
  const [newsOk, setNewsOk] = useState(false);
  // Handtekening.
  const [signature, setSignature] = useState("");

  const [message, setMessage] = useState<Message>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  const keystoneOk = kWatchlist && kContext && kPlan;
  const otherRequiredOk = riskSl && riskInvalidation && newsOk && signature.trim() !== "" && instrument.trim() !== "";

  function currentInput(): SignContractInput {
    const risk = Number(riskPct);
    return {
      instrument: instrument.trim() || null,
      fase,
      entry_type: null,
      risk_pct: Number.isFinite(risk) ? risk : null,
      signature: signature.trim() || null,
    };
  }

  function reset() {
    setKWatchlist(false);
    setKContext(false);
    setKPlan(false);
    setFase("F2");
    setInstrument("");
    setRiskPct("1");
    setRiskSl(false);
    setRiskInvalidation(false);
    setNewsOk(false);
    setSignature("");
  }

  async function doSign() {
    // Poort 0 is the hard gate — an unchecked keystone box is a refusal, not a save.
    if (!keystoneOk) {
      setMessage({ tone: "refusal", text: t("contract.refusalKeystone") });
      return;
    }
    if (!otherRequiredOk) {
      setMessage({ tone: "prompt", text: t("contract.promptMissing") });
      return;
    }
    setSubmitting(true);
    try {
      await onSign(currentInput());
      setMessage({ tone: "success", text: t("contract.signedConfirm") });
      reset();
    } catch (err) {
      setMessage({ tone: "prompt", text: toErrorMessage(err, t("contract.saveFailed")) });
    } finally {
      setSubmitting(false);
    }
  }

  async function doMissed() {
    setDoubtOpen(false);
    setSubmitting(true);
    try {
      await onMissed(currentInput());
      setMessage({ tone: "refusal", text: t("contract.missedConfirm") });
      reset();
    } catch (err) {
      setMessage({ tone: "prompt", text: toErrorMessage(err, t("contract.saveFailed")) });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDoubtSign() {
    setDoubtOpen(false);
    void doSign();
  }

  return (
    <Card className="flex flex-col gap-5">
      {/* Poort 0 — Keystone */}
      <section className="flex flex-col gap-2.5">
        <div>
          <h2 className="font-display text-xl italic text-ink">{t("contract.keystoneTitle")}</h2>
          <p className="text-xs text-muted mt-0.5">{t("contract.keystoneIntro")}</p>
        </div>
        <CheckRow checked={kWatchlist} onChange={setKWatchlist} label={t("contract.keystoneWatchlist")} />
        <CheckRow checked={kContext} onChange={setKContext} label={t("contract.keystoneContext")} />
        <CheckRow checked={kPlan} onChange={setKPlan} label={t("contract.keystonePlan")} />
      </section>

      {/* Fase + instrument */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">{t("contract.faseLabel")}</label>
          <div className="inline-flex shrink-0 rounded-lg border border-border divide-x divide-border overflow-hidden self-start">
            {FASES.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFase(f)}
                aria-pressed={fase === f}
                className={clsx(
                  "px-4 py-1.5 text-sm font-body transition-colors",
                  fase === f ? "bg-gold text-on-gold" : "bg-surface-2 text-muted hover:text-ink"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">{t("contract.instrumentLabel")}</label>
          <input
            type="text"
            className="input"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            placeholder={t("contract.instrumentPlaceholder")}
          />
        </div>
      </section>

      {/* Poort 3 — Risk */}
      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-xl italic text-ink">{t("contract.riskTitle")}</h2>
        <div className="flex flex-col gap-1.5 max-w-[8rem]">
          <label className="text-xs uppercase tracking-wider text-muted">{t("contract.riskPctLabel")}</label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="input"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
          />
        </div>
        <CheckRow checked={riskSl} onChange={setRiskSl} label={t("contract.riskSl")} />
        <CheckRow checked={riskInvalidation} onChange={setRiskInvalidation} label={t("contract.riskInvalidation")} />
      </section>

      {/* Poort 4 — Nieuws */}
      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-xl italic text-ink">{t("contract.newsTitle")}</h2>
        <CheckRow checked={newsOk} onChange={setNewsOk} label={t("contract.newsCheck")} />
      </section>

      {/* Handtekening */}
      <section className="flex flex-col gap-1.5">
        <label className="text-xs uppercase tracking-wider text-muted">{t("contract.signatureLabel")}</label>
        <input
          type="text"
          className="input"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={t("contract.signaturePlaceholder")}
        />
      </section>

      {message && (
        <p
          className={clsx(
            "text-sm font-body",
            message.tone === "success" ? "text-win" : "text-loss"
          )}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          onClick={() => void doSign()}
          disabled={submitting}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60"
        >
          <FileSignature size={15} /> {t("contract.sign")}
        </button>
        <button
          type="button"
          onClick={() => setDoubtOpen(true)}
          disabled={submitting}
          className="px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-ink border border-border disabled:opacity-60"
        >
          {t("contract.doubtButton")}
        </button>
      </div>

      {doubtOpen && (
        <Modal labelledBy="contract-doubt-title" maxWidthClass="max-w-md" onClose={() => setDoubtOpen(false)}>
          {(requestClose) => (
            <div className="flex flex-col gap-4">
              <h2 id="contract-doubt-title" className="font-display text-2xl italic text-ink">
                {t("contract.doubtTitle")}
              </h2>
              <p className="text-sm text-ink">{t("contract.doubtBody")}</p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDoubtSign}
                  className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
                >
                  {t("contract.doubtSign")}
                </button>
                <button
                  type="button"
                  onClick={() => void doMissed()}
                  className="px-4 py-2 rounded-lg font-body text-sm text-loss border border-border hover:bg-loss/10"
                >
                  {t("contract.doubtSkip")}
                </button>
                <button
                  type="button"
                  onClick={requestClose}
                  className="px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-ink"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
}

/** A single required checkbox row — the shared row markup for every gate. */
function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-gold focus:ring-gold accent-gold"
      />
      <span>{label}</span>
    </label>
  );
}
