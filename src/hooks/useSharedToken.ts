import { useEffect, useState } from "react";

export interface SharedTokenState<T> {
  data: T | null;
  loading: boolean;
  /** Network/RPC error — distinct from a valid response of null (invalid/revoked/expired token). */
  failed: boolean;
}

/**
 * Token-fetch plumbing shared by SharePage and ShareReviewPage: one anonymous
 * RPC call per token, with reset-before-fetch so on a token change the previous
 * payload (or a stale failure) never lingers under the new URL. `fetch` must be
 * referentially stable per token (pass the imported RPC wrapper, not an inline
 * closure over changing state).
 */
export function useSharedToken<T>(token: string | undefined, fetch: (token: string) => Promise<T | null>): SharedTokenState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null);
    setFailed(false);
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { data, loading, failed };
}
