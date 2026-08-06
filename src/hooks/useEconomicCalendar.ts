import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EconomicEvent } from "@/lib/economicCalendar";

export function useEconomicCalendar() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ff-calendar");
      if (!res.ok) throw new Error(t("economicCalendar.feedError", { status: res.status }));
      const data = (await res.json()) as EconomicEvent[];
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("economicCalendar.loadFailed"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { events, loading, error, refresh };
}
