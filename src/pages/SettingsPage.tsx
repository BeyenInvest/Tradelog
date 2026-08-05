import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCustomOptions } from "@/hooks/useCustomOptions";
import { ENTRIES } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errorMessage";

export default function SettingsPage() {
  const { hideFase, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleFase(showFase: boolean) {
    setError(null);
    setSaving(true);
    try {
      await updateProfile({ hide_fase: !showFase });
    } catch (err) {
      setError(toErrorMessage(err, "Opslaan is mislukt"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Instellingen" subtitle="Persoonlijke voorkeuren voor je account" />
      <div className="flex flex-col gap-5 max-w-xl">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-body text-sm text-ink">Fasen tonen</p>
              <p className="font-mono text-xs mt-1 text-muted">
                Schakelt het "4 fasen"-systeem uit in het trade-formulier, filters, journal en backtesting-analyse. Je
                eigen historiek blijft ongewijzigd.
              </p>
            </div>
            <BooleanToggle value={!hideFase} onChange={handleToggleFase} labels={["Aan", "Uit"]} />
          </div>
          {saving && <p className="font-mono text-[11px] mt-3 text-muted">Bezig met opslaan...</p>}
          {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}
        </Card>

        <CustomEntryOptions />
      </div>
    </>
  );
}

/** Extra "Entry"-waarden bovenop de vaste ENTRIES-lijst — alleen zichtbaar/bruikbaar voor jezelf, niet voor andere accounts. */
function CustomEntryOptions() {
  const { options, loading, addOption, deleteOption } = useCustomOptions("entry");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const existing = new Set([...ENTRIES, ...options.map((o) => o.value)].map((v) => v.toLowerCase()));

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
    }
  }

  async function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (existing.has(trimmed.toLowerCase())) {
      setError("Deze waarde bestaat al");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await addOption(trimmed);
      setValue("");
    } catch (err) {
      setError(toErrorMessage(err, "Toevoegen is mislukt"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <p className="font-body text-sm text-ink">Eigen Entry-opties</p>
      <p className="font-mono text-xs mt-1 text-muted">
        Extra waarden voor het "Entry"-veld, naast de vaste lijst — enkel zichtbaar in jouw eigen trade-formulier.
      </p>

      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nieuwe entry..."
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={saving || !value.trim()}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Toevoegen
        </button>
      </div>
      {error && <p className="font-mono text-[11px] mt-2 text-loss">{error}</p>}

      {!loading && options.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {options.map((o) => (
            <span
              key={o.id}
              className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-border-soft font-mono text-xs text-ink"
            >
              {o.value}
              <button
                type="button"
                onClick={() => void deleteOption(o.id)}
                className="p-0.5 rounded-full hover:bg-ink/5 text-muted hover:text-loss"
                aria-label={`${o.value} verwijderen`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
