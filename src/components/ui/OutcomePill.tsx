import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Outcome } from "@/lib/constants";

const MAP: Record<Outcome, { bg: string; fg: string; icon: typeof TrendingUp }> = {
  Win: { bg: "rgba(95,174,130,0.14)", fg: "#5FAE82", icon: TrendingUp },
  Loss: { bg: "rgba(224,102,90,0.14)", fg: "#E0665A", icon: TrendingDown },
  BE: { bg: "rgba(139,147,167,0.14)", fg: "#8B93A7", icon: Minus },
};

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  const { bg, fg, icon: Icon } = MAP[outcome];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-xs"
      style={{ background: bg, color: fg }}
    >
      <Icon size={12} /> {outcome}
    </span>
  );
}
