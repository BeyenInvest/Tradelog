import type { EconomicEvent } from "@/lib/economicCalendar";
import { ImpactBadge } from "./ImpactBadge";

export function EconomicEventRow({ event }: { event: EconomicEvent }) {
  const time = new Date(event.date).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="grid grid-cols-[64px_60px_1fr_90px_80px_80px] gap-3 items-center py-2 border-b border-border-soft font-mono text-xs">
      <span className="text-muted">{time}</span>
      <span className="text-ink font-body font-medium">{event.country}</span>
      <span className="text-ink font-body truncate">{event.title}</span>
      <span className="flex justify-start">
        <ImpactBadge impact={event.impact} />
      </span>
      <span className="text-muted text-right">{event.forecast || "—"}</span>
      <span className="text-muted text-right">{event.previous || "—"}</span>
    </div>
  );
}
