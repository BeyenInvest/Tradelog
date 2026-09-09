import { useEffect, useRef } from "react";

/**
 * Roept `refetch` aan wanneer de tab weer zichtbaar/gefocust wordt (fixplan F2,
 * C-R2-2): een tab die uren openstond toont anders stille, verouderde data —
 * trades die op een ander apparaat gelogd zijn, een journal-switch in een
 * andere tab, een profielwijziging. Gethrottled met `minIntervalMs` zodat het
 * focus+visibilitychange-duo (vuurt vaak samen) en snel tab-wisselen niet
 * telkens een verse fetch afvuren.
 *
 * De callback wordt via een ref gelezen — de listener wordt één keer gezet en
 * ziet altijd de nieuwste refetch (zelfde patroon als useModalGuard).
 */
export function useVisibilityRefetch(refetch: () => void, minIntervalMs = 60_000): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const lastRef = useRef(Date.now());

  useEffect(() => {
    const maybeRefetch = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRef.current < minIntervalMs) return;
      lastRef.current = now;
      refetchRef.current();
    };
    window.addEventListener("focus", maybeRefetch);
    document.addEventListener("visibilitychange", maybeRefetch);
    return () => {
      window.removeEventListener("focus", maybeRefetch);
      document.removeEventListener("visibilitychange", maybeRefetch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
