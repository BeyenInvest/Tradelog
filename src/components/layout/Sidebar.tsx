import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Target, BookOpen, NotebookPen, Wallet, CalendarClock, Calculator, LogOut, ShieldCheck, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { JournalSwitcher } from "@/components/layout/JournalSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toErrorMessage } from "@/lib/errorMessage";
// Account deletion (DeleteAccountModal + useAuth.deleteAccount) is built but
// deliberately not exposed here yet — too easy to stumble into from the main
// nav. Re-surface it from a dedicated profile/settings entry point once that
// exists (e.g. alongside subscription management at public launch).

const NAV = [
  { to: "/journal", labelKey: "nav.journal", icon: BookOpen },
  { to: "/backtesting", labelKey: "nav.backtesting", icon: Target },
  { to: "/reviews", labelKey: "nav.reviews", icon: NotebookPen },
  { to: "/accounts", labelKey: "nav.accounts", icon: Wallet },
  { to: "/calendar", labelKey: "nav.calendar", icon: CalendarClock },
  { to: "/lot-size", labelKey: "nav.lotSize", icon: Calculator },
];

export function Sidebar() {
  const { signOut, isAdmin, betaFeatures } = useAuth();
  const { isForexJournal } = useMethodology();
  const { t } = useTranslation();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  // The lot-size calculator is a forex-only tool (pips/lots) — show it only when the
  // active journal trades forex, not in a stocks/crypto/futures journal (cyclus 7).
  const base = isForexJournal ? NAV : NAV.filter((n) => n.to !== "/lot-size");
  const nav = isAdmin ? [...base, { to: "/admin", labelKey: "nav.admin", icon: ShieldCheck }] : base;

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(toErrorMessage(err, t("nav.logoutFailed")));
    }
  }

  return (
    <aside className="relative w-full md:w-56 md:shrink-0 flex flex-row md:flex-col items-center md:items-stretch justify-between py-3 md:py-6 px-4 border-b md:border-b-0 md:border-r border-border md:overflow-y-auto">
      {signOutError && (
        <p className="absolute left-4 right-4 bottom-1 md:bottom-2 text-[11px] text-loss text-center md:text-left">
          {signOutError}
        </p>
      )}
      <div className="flex items-center gap-2 md:px-2 md:mb-8 shrink-0">
        <LogoMark size={20} className="text-gold" />
        <span className="hidden sm:inline font-display text-2xl italic tracking-wide text-ink"><Wordmark /></span>
      </div>

      {/* Active-journal switcher (cyclus 3b). Full-width in the desktop column; a
          compact variant in the mobile top bar so mobile can switch/create too.
          Soft-launch: beta-flagged users only (0033) until the public launch. */}
      {betaFeatures && (
        <>
          <div className="hidden md:block md:px-2 md:mb-6 shrink-0">
            <JournalSwitcher />
          </div>
          <div className="md:hidden shrink-0 min-w-0 max-w-[8.5rem]">
            <JournalSwitcher compact />
          </div>
        </>
      )}

      {/* flex-1 + min-w-0 lets this item both absorb the row's remaining width AND shrink below its
          content size on mobile, so overflow-x-auto actually kicks in instead of the row silently
          clipping under AppShell's overflow-hidden when there isn't room for every nav item. */}
      <nav className="flex flex-row md:flex-col flex-1 md:flex-none gap-1 min-w-0 overflow-x-auto md:overflow-visible px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              aria-label={t(n.labelKey)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 md:px-3 py-2 rounded-lg font-body text-sm transition-colors shrink-0 ${
                  isActive ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "text-gold" : "text-muted"} />
                  <span className="hidden md:inline">{t(n.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="hidden md:flex md:mt-auto flex-col gap-3 px-2">
        <ThemeToggle />
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 text-xs font-body transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`
          }
        >
          <Settings size={14} /> {t("nav.settings")}
        </NavLink>
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-2 text-xs font-body text-muted hover:text-ink transition-colors"
        >
          <LogOut size={14} /> {t("nav.logout")}
        </button>
      </div>
      <div className="flex items-center gap-1 md:hidden shrink-0">
        <ThemeToggle iconOnly />
        <NavLink
          to="/settings"
          aria-label={t("nav.settings")}
          className={({ isActive }) => `p-2 rounded-lg ${isActive ? "text-ink" : "text-muted hover:text-ink"}`}
        >
          <Settings size={16} />
        </NavLink>
        <button
          onClick={() => void handleSignOut()}
          aria-label={t("nav.logout")}
          className="p-2 rounded-lg text-muted hover:text-ink"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
