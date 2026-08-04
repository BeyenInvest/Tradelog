import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EconomicEventRow } from "@/components/economic/EconomicEventRow";
import { useEconomicCalendar } from "@/hooks/useEconomicCalendar";
import { groupEventsByDay, type EconomicImpact } from "@/lib/economicCalendar";

const IMPACT_OPTIONS: EconomicImpact[] = ["Low", "Medium", "High", "Holiday"];

export default function EconomicCalendarPage() {
  const { events, loading, error, refresh } = useEconomicCalendar();
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [impactFilter, setImpactFilter] = useState<Set<EconomicImpact>>(new Set(["Medium", "High"]));

  const currencies = useMemo(() => Array.from(new Set(events.map((e) => e.country))).sort(), [events]);

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (currencyFilter && e.country !== currencyFilter) return false;
        if (impactFilter.size > 0 && !impactFilter.has(e.impact)) return false;
        return true;
      }),
    [events, currencyFilter, impactFilter]
  );

  const groups = useMemo(() => groupEventsByDay(filtered), [filtered]);

  function toggleImpact(impact: EconomicImpact) {
    setImpactFilter((prev) => {
      const next = new Set(prev);
      if (next.has(impact)) next.delete(impact);
      else next.add(impact);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Economic Calendar"
        subtitle="Deze week — bron: ForexFactory (niet-officiële feed, cache ververst elke 30 min server-side)"
        action={
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-surface-2 text-ink hover:bg-ink/5"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Ververs
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={currencyFilter}
          onChange={(e) => setCurrencyFilter(e.target.value)}
          className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold"
        >
          <option value="">Alle valuta</option>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {IMPACT_OPTIONS.map((impact) => (
            <button
              key={impact}
              onClick={() => toggleImpact(impact)}
              aria-pressed={impactFilter.has(impact)}
              className={`px-3 py-2 text-xs font-body transition-colors ${
                impactFilter.has(impact) ? "bg-gold text-on-gold" : "bg-surface-2 text-muted"
              }`}
            >
              {impact}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="mb-5 border-loss/40">
          <p className="text-sm text-loss">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-muted text-sm">Laden...</p>
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Geen events voor deze filters.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <Card key={group.dateKey}>
              <h3 className="font-display text-lg italic mb-3 text-ink capitalize">
                {new Date(group.dateKey + "T00:00:00").toLocaleDateString("nl-BE", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </h3>
              <div className="grid grid-cols-[64px_60px_1fr_90px_80px_80px] gap-3 font-body text-[11px] uppercase tracking-wide pb-2 mb-1 text-muted border-b border-border">
                <span>Tijd</span>
                <span>Valuta</span>
                <span>Event</span>
                <span>Impact</span>
                <span className="text-right">Forecast</span>
                <span className="text-right">Previous</span>
              </div>
              {group.events.map((event, i) => (
                <EconomicEventRow key={`${event.title}-${event.date}-${i}`} event={event} />
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
