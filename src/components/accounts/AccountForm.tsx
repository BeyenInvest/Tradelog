import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { PROP_FASES, type PropFase } from "@/lib/constants";
import type { PropAccountInput } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

export function AccountForm({ onSubmit }: { onSubmit: (input: PropAccountInput) => Promise<unknown> }) {
  const [naam, setNaam] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [fase, setFase] = useState<PropFase>("Phase 1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!naam || !accountSize) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ naam, account_size: Number(accountSize), fase, actief: true });
      setNaam("");
      setAccountSize("");
      setFase("Phase 1");
    } catch (err) {
      setError(toErrorMessage(err, "Aanmaken van account is mislukt"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="font-display text-lg italic mb-3 text-ink">Nieuw account</h3>
      <form onSubmit={handleSubmit} className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">Naam</label>
          <input type="text" className="input w-48" value={naam} onChange={(e) => setNaam(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">Account size</label>
          <input type="number" step="0.01" className="input w-32" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-wider text-muted">Fase</label>
          <EnumSelect options={PROP_FASES} value={fase} onChange={(e) => setFase(e.target.value as PropFase)} className="w-36" />
        </div>
        <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60">
          {submitting ? "Bezig..." : "Toevoegen"}
        </button>
      </form>
      {error && <p className="text-sm text-loss mt-2">{error}</p>}
    </Card>
  );
}
