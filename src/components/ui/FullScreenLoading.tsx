import { useTranslation } from "react-i18next";

/**
 * The app's boot-loading screen — one component for every full-screen wait
 * (auth gate, lazy-route Suspense fallback, the share page's token fetch), so a
 * restyle reaches them all and a visitor never sees two different loaders flip
 * mid-load.
 */
export function FullScreenLoading() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg">
      <p className="font-mono text-sm text-muted">{t("common.loading")}</p>
    </div>
  );
}
