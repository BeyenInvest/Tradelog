import { useEffect } from "react";

/**
 * Adds <meta name="robots" content="noindex"> for the lifetime of the page.
 * Share URLs are unlisted capabilities — keep search engines from indexing one
 * that ends up linked somewhere public. SPA, so the tag is set per-route here
 * (shared by SharePage and ShareReviewPage).
 */
export function useNoIndexMeta(): void {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
