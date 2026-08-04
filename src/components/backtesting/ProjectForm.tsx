import { useState, type FormEvent } from "react";
import type { BacktestProject, BacktestProjectInput } from "@/lib/types";
import { toErrorMessage } from "@/lib/errorMessage";

interface ProjectFormProps {
  project?: BacktestProject;
  onSubmit: (input: BacktestProjectInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function ProjectForm({ project, onSubmit, onCancel }: ProjectFormProps) {
  const [naam, setNaam] = useState(project?.naam ?? "");
  const [beschrijving, setBeschrijving] = useState(project?.beschrijving ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!naam.trim()) {
      setError("Vul een naam in.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ naam: naam.trim(), beschrijving: beschrijving.trim() || null });
      if (!project) {
        setNaam("");
        setBeschrijving("");
      }
    } catch (err) {
      setError(toErrorMessage(err, "Opslaan van project is mislukt"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
          <label className="text-xs uppercase tracking-wider text-muted">Naam</label>
          <input type="text" className="input" value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. EURUSD reversal test" />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <label className="text-xs uppercase tracking-wider text-muted">Beschrijving (optioneel)</label>
          <input type="text" className="input" value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-ink">
              Annuleren
            </button>
          )}
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-60">
            {submitting ? "Bezig..." : project ? "Opslaan" : "Project aanmaken"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
    </form>
  );
}
