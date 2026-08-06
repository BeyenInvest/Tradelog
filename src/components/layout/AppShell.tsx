import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const { t } = useTranslation();
  return (
    <div className="h-screen w-full flex flex-col md:flex-row font-body bg-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto">
        {/* Suspense sits inside the shell so a lazily-loaded page swaps in without
            the sidebar flashing away — see the code-split pages in router.tsx. */}
        <Suspense fallback={<p className="font-mono text-sm text-muted">{t("common.loading")}</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
