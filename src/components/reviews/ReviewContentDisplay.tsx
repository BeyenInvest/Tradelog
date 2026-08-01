interface ReviewContentDisplayProps {
  technisch: string | null;
  mentaal_owner: string | null;
  mentaal_trader: string | null;
  acties: string[];
  takeaway: string | null;
  overall_comment: string | null;
}

/** Read-only rendering of the technisch/mentaal/acties/takeaway/overall-comment fields, shared by weekly and periodic review detail views. */
export function ReviewContentDisplay({ technisch, mentaal_owner, mentaal_trader, acties, takeaway, overall_comment }: ReviewContentDisplayProps) {
  return (
    <>
      {technisch && (
        <div>
          <p className="font-body text-xs uppercase tracking-wider mb-1 text-gold">Technisch</p>
          <p className="font-body text-sm leading-relaxed text-ink whitespace-pre-wrap">{technisch}</p>
        </div>
      )}
      {(mentaal_owner || mentaal_trader) && (
        <div className="grid grid-cols-2 gap-4">
          {mentaal_owner && (
            <div>
              <p className="font-body text-xs uppercase tracking-wider mb-1 text-gold">Mentaal — Owner</p>
              <p className="font-body text-sm leading-relaxed text-ink whitespace-pre-wrap">{mentaal_owner}</p>
            </div>
          )}
          {mentaal_trader && (
            <div>
              <p className="font-body text-xs uppercase tracking-wider mb-1 text-gold">Mentaal — Trader</p>
              <p className="font-body text-sm leading-relaxed text-ink whitespace-pre-wrap">{mentaal_trader}</p>
            </div>
          )}
        </div>
      )}
      {acties.length > 0 && (
        <div>
          <p className="font-body text-xs uppercase tracking-wider mb-2 text-gold">Acties</p>
          <div className="flex flex-wrap gap-2">
            {acties.map((a, i) => (
              <span key={i} className="font-mono text-xs px-2 py-1 rounded-md bg-surface-2 text-muted border border-border">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      {takeaway && (
        <div className="rounded-lg p-4 bg-bg border border-border">
          <p className="font-body text-xs uppercase tracking-wider mb-1 text-gold">Wat neem ik mee?</p>
          <p className="font-display text-lg italic leading-snug text-ink">{takeaway}</p>
        </div>
      )}
      {overall_comment && (
        <div>
          <p className="font-body text-xs uppercase tracking-wider mb-1 text-gold">Overall comment</p>
          <p className="font-body text-sm leading-relaxed text-ink whitespace-pre-wrap">{overall_comment}</p>
        </div>
      )}
    </>
  );
}
