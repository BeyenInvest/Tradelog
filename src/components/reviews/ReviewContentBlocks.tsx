import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Every review section is the same quiet "page" (owner 2026-09-25: the mix of
 * tinted/bordered/quoted cards was "veel tralala", the plain version a "muur aan
 * tekst"): one softly tinted panel per section, set apart by surface rather than
 * borders, headed by Beyen's gold caps label, body copy capped at a book-like
 * line length. Only the takeaway gets a warmer (gold) tint — the one thing to
 * carry into next week.
 */
const PANEL = "flex flex-col gap-2 rounded-xl px-6 py-5";
// Half-strength tint reads right on the white light-mode card; on the dark card
// that is ~invisible, so dark mode takes the full surface-2 (= the chart cards).
const TINT = "bg-surface-2/50 dark:bg-surface-2";
// Beyen's own label voice (same as RESULTAAT / WIN RATE in the stats block above),
// one step firmer than the 11px/90% original so it stands out on the tinted panel.
const HEADING = "font-body text-xs font-medium uppercase tracking-[0.14em] text-gold";
const BODY = "font-body text-[15px] leading-[1.75] text-ink/90 whitespace-pre-wrap max-w-[68ch]";

/** One review section — serif heading + body on a softly tinted panel. */
export function ContentBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${PANEL} ${TINT}`}>
      <h4 className={HEADING}>{label}</h4>
      <p className={BODY}>{children}</p>
    </div>
  );
}

/** A personal/reflective note (the weekly review's mentaal voice) — same plain block as the rest; no separate card any more. */
export function VoiceBlock({ label, children }: { label: string; children: ReactNode }) {
  return <ContentBlock label={label}>{children}</ContentBlock>;
}

function parseActie(a: string): { label: string; status: "ok" | "niet-ok" | null; value: string | null } {
  const m = a.match(/^(.+?):\s*(.+)$/);
  if (!m) return { label: a, status: null, value: null };
  const value = m[2].trim();
  const normalized = value.toLowerCase();
  const status = normalized === "ok" ? "ok" : normalized === "niet ok" || normalized === "not ok" ? "niet-ok" : null;
  return { label: m[1].trim(), status, value: status ? null : value };
}

/** Acties/werkpunten — "Label: ok"/"Label: niet ok" render as a checklist; anything else (a goal sentence) falls back to a plain bullet. */
export function ActiesList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={`${PANEL} ${TINT}`}>
      <h4 className={HEADING}>{label}</h4>
      <div className="flex flex-col gap-1.5">
        {items.map((a, i) => {
          const { label: itemLabel, status, value } = parseActie(a);
          return (
            <div key={i} className="flex items-center gap-2.5 font-body text-[15px]">
              {status === "ok" && <Check size={14} className="shrink-0 text-win" />}
              {status === "niet-ok" && <X size={14} className="shrink-0 text-loss" />}
              {status === null && <span className="shrink-0 w-1 h-1 rounded-full bg-faint" />}
              <span className="text-ink/90">{itemLabel}</span>
              {value && <span className="text-muted">— {value}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The review's takeaway/conclusie — the one section with an accent: the same panel, warmed with a gold tint. */
export function TakeawayQuote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${PANEL} bg-gold/[0.08] dark:bg-gold/[0.12]`}>
      <h4 className={HEADING}>{label}</h4>
      <p className={`${BODY} text-ink`}>{children}</p>
    </div>
  );
}

/** The review's final word — same plain block as the rest. */
export function OverallCommentBlock({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation();
  return <ContentBlock label={label ?? t("reviewContent.overallComment")}>{children}</ContentBlock>;
}
