import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/** A factual/analytical note — plain body copy under a small gold caps label. */
export function ContentBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-body text-[11px] uppercase tracking-[0.14em] text-gold/90">{label}</p>
      <p className="font-body text-[15px] leading-[1.7] text-ink/90 whitespace-pre-wrap">{children}</p>
    </div>
  );
}

/** A personal/reflective note (the weekly review's Owner/Trader voices) — body copy on a quietly tinted card, set apart from the factual blocks by its surface rather than a different typeface. */
export function VoiceBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg p-4 bg-surface-2/50 border border-border-soft">
      <p className="font-body text-[11px] uppercase tracking-[0.14em] text-gold/90">{label}</p>
      <p className="font-body text-[15px] leading-[1.7] text-ink/90 whitespace-pre-wrap">{children}</p>
    </div>
  );
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
    <div className="flex flex-col gap-2.5">
      <p className="font-body text-[11px] uppercase tracking-[0.14em] text-gold/90">{label}</p>
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

/** The hero pull-quote for a review's takeaway/conclusie — body copy on a gold-tinted card with a decorative quote mark. */
export function TakeawayQuote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative rounded-xl p-5 pl-7 bg-gradient-to-br from-gold/[0.08] via-transparent to-transparent border border-gold/20 overflow-hidden">
      <span className="absolute left-2 top-0 font-display text-6xl leading-none text-gold/20 select-none">&ldquo;</span>
      <p className="font-body text-[11px] uppercase tracking-[0.14em] text-gold/90 mb-2">{label}</p>
      <p className="font-body text-[15px] leading-[1.7] text-ink whitespace-pre-wrap">{children}</p>
    </div>
  );
}

/** The review's final word — given real visual weight (bordered card, clear label, ink-toned text) since it's the closing conclusion, not an afterthought. */
export function OverallCommentBlock({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl p-5 border border-gold/25 bg-gold/[0.04]">
      <p className="font-body text-[11px] uppercase tracking-[0.14em] text-gold/90 mb-2">{label ?? t("reviewContent.overallComment")}</p>
      <p className="font-body text-[15px] leading-[1.7] text-ink whitespace-pre-wrap">{children}</p>
    </div>
  );
}
