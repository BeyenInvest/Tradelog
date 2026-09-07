import { Fragment, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Target, BookOpen, NotebookPen, Wallet, CalendarClock, Calculator, LogOut, ShieldCheck, Settings, FileSignature, ListChecks, NotebookText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { LogoMark, LogoLockup } from "@/components/ui/Logo";
import { JournalSwitcher } from "@/components/layout/JournalSwitcher";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toErrorMessage } from "@/lib/errorMessage";
// Account deletion (DeleteAccountModal + useAuth.deleteAccount) is intentionally
// not in the main nav — too easy to stumble into. Its entry point lives in the
// Settings "Account" section (SettingsPage → DeleteAccountSettings) instead.

type NavItem = { to: string; labelKey: string; icon: LucideIcon };
type NavGroup = { labelKey: string; items: NavItem[] };

export function Sidebar() {
  const { signOut, isAdmin, betaFeatures } = useAuth();
  const { isForexJournal } = useMethodology();
  const { t } = useTranslation();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // The nav is grouped into labelled sections. Section headers show only in the
  // desktop column; on the mobile top bar they're hidden so the icons stay in one
  // flat horizontal scroll row. Each group is gated independently and empty groups
  // are dropped, so the headers never sit above nothing.
  const groups: NavGroup[] = [
    {
      labelKey: "nav.catTrading",
      items: [
        { to: "/journal", labelKey: "nav.journal", icon: BookOpen },
        { to: "/backtesting", labelKey: "nav.backtesting", icon: Target },
        { to: "/reviews", labelKey: "nav.reviews", icon: NotebookPen },
        { to: "/accounts", labelKey: "nav.accounts", icon: Wallet },
      ],
    },
    {
      // Contract + Habits + Dagboek are owner-only until public launch — same
      // soft-launch gate (betaFeatures, 0033) as the journal-switcher below.
      labelKey: "nav.catPerformance",
      items: betaFeatures
        ? [
            { to: "/contract", labelKey: "nav.contract", icon: FileSignature },
            { to: "/habits", labelKey: "nav.habits", icon: ListChecks },
            { to: "/daily", labelKey: "nav.dailyJournal", icon: NotebookText },
          ]
        : [],
    },
    {
      labelKey: "nav.catTools",
      items: [
        { to: "/calendar", labelKey: "nav.calendar", icon: CalendarClock },
        // The lot-size calculator is a forex-only tool (pips/lots) — show it only
        // when the active journal trades forex (cyclus 7).
        ...(isForexJournal ? [{ to: "/lot-size", labelKey: "nav.lotSize", icon: Calculator }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  // Admin stays outside the sections — a standalone item at the end of the list.
  const adminItem: NavItem | null = isAdmin ? { to: "/admin", labelKey: "nav.admin", icon: ShieldCheck } : null;

  function renderItem(n: NavItem) {
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
  }

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
      <div className="flex items-center md:px-2 md:mb-8 shrink-0">
        <LogoMark size={22} className="sm:hidden text-gold" />
        <LogoLockup size={24} className="hidden sm:block text-gold" />
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
          clipping under AppShell's overflow-hidden when there isn't room for every nav item.
          Section headers are hidden on mobile (display:none), so on the horizontal bar every icon
          is a direct flex child and the row flows/scrolls exactly as before the grouping. */}
      <nav className="flex flex-row md:flex-col flex-1 md:flex-none gap-1 min-w-0 overflow-x-auto md:overflow-visible px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => (
          <Fragment key={group.labelKey}>
            <p className="hidden md:block px-3 mt-3 first:mt-0 mb-0.5 text-[10px] font-body font-medium uppercase tracking-[0.12em] text-muted/60">
              {t(group.labelKey)}
            </p>
            {group.items.map(renderItem)}
          </Fragment>
        ))}
        {adminItem && renderItem(adminItem)}
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
