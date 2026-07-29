import { useCallback, useEffect, useState } from "react";
import type { EconomicEvent } from "@/lib/economicCalendar";

export function useEconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ff-calendar");
      if (!res.ok) throw new Error(`Kalender-feed gaf status ${res.status}`);
      const data = (await res.json()) as EconomicEvent[];
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon economic calendar niet laden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
