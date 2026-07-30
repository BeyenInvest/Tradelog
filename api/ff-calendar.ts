// Production stand-in for the Vite dev server's /api/ff-calendar proxy (see
// vite.config.ts). The unofficial ForexFactory feed has no CORS headers, so
// the browser can't fetch it directly — this serverless function fetches it
// server-side instead, same as the dev proxy did.

/** Minimal shape of Vercel's Node response object — avoids pulling in @vercel/node just for types. */
interface VercelStyleResponse {
  status(code: number): VercelStyleResponse;
  json(body: unknown): void;
  send(body: string): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(_req: unknown, res: VercelStyleResponse) {
  try {
    const upstream = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Kalender-feed gaf status ${upstream.status}` });
      return;
    }

    const body = await upstream.text();
    res.setHeader("content-type", "application/json");
    // ForexFactory publishes this feed weekly — cache at the edge for 30 min,
    // serve stale for up to an hour while revalidating in the background.
    res.setHeader("cache-control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).send(body);
  } catch {
    // Network failure, DNS issue, or the 8s timeout tripping — upstream is unreachable either way.
    res.status(502).json({ error: "Kalender-feed onbereikbaar" });
  }
}
