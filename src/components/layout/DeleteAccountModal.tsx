import { useState } from "react";
import { X } from "lucide-react";
import { useModalGuard } from "@/hooks/useModalGuard";
import { toErrorMessage } from "@/lib/errorMessage";

const CONFIRM_PHRASE = "VERWIJDEREN";

interface DeleteAccountModalProps {
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Deliberately heavier friction than the app's other delete confirmations (typed phrase, not just a click) — this one takes everything, not one record. */
export function DeleteAccountModal({ onConfirm, onClose }: DeleteAccountModalProps) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestClose = useModalGuard(false, onClose);
  const canConfirm = typed === CONFIRM_PHRASE && !deleting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(toErrorMessage(err, "Verwijderen van account is mislukt"));
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={requestClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-surface border border-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl italic text-loss">Account verwijderen</h2>
          <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
            <X size={18} />
          </button>
        </div>

        <p className="font-body text-sm text-muted mb-3">
          Dit verwijdert direct en onomkeerbaar: al je trades, weekly- en periodic reviews, backtestprojecten,
          prop-accounts en payouts, en je account zelf. Er is geen manier om dit terug te draaien of te herstellen.
        </p>
        <p className="font-body text-sm text-muted mb-4">
          Typ <span className="font-mono text-ink">{CONFIRM_PHRASE}</span> hieronder om te bevestigen.
        </p>

        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={CONFIRM_PHRASE}
          className="input font-mono mb-4"
        />

        {error && <p className="font-body text-sm text-loss mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={requestClose}
            className="px-4 py-2 rounded-lg font-body text-sm text-muted hover:text-ink"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-loss text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "Bezig met verwijderen..." : "Definitief verwijderen"}
          </button>
        </div>
      </div>
    </div>
  );
}
