import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Outcome } from "@/lib/constants";

const MAP: Record<Outcome, { className: string; icon: typeof TrendingUp }> = {
  Win: { className: "bg-win/15 text-win", icon: TrendingUp },
  Loss: { className: "bg-loss/15 text-loss", icon: TrendingDown },
  BE: { className: "bg-be/15 text-be", icon: Minus },
};

/** `muted` renders a neutral gray pill regardless of outcome — used for hypothetical (missed) trades, so a dimmed-red "Loss" is never mistaken for a real one at a glance. */
export function OutcomePill({ outcome, muted = false }: { outcome: Outcome; muted?: boolean }) {
  const { className, icon: Icon } = MAP[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs ${
        muted ? "bg-surface-2 text-faint" : className
      }`}
    >
      <Icon size={12} /> {outcome}
    </span>
  );
}
