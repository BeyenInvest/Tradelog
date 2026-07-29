// Production stand-in for the Vite dev server's /api/ff-calendar proxy (see
// vite.config.ts). The unofficial ForexFactory feed has no CORS headers, so
// the browser can't fetch it directly — this Edge function fetches it
// server-side instead, same as the dev proxy did.
export const config = { runtime: "edge" };

export default async function handler() {
  const upstream = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: `Kalender-feed gaf status ${upstream.status}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      // ForexFactory publishes this feed weekly — cache at the edge for 30 min,
      // serve stale for up to an hour while revalidating in the background.
      "cache-control": "s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
