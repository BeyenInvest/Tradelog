import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Target, BookOpen, NotebookPen, Wallet, CalendarClock, Calculator, LogOut, ShieldCheck, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toErrorMessage } from "@/lib/errorMessage";
// Account deletion (DeleteAccountModal + useAuth.deleteAccount) is built but
// deliberately not exposed here yet — too easy to stumble into from the main
// nav. Re-surface it from a dedicated profile/settings entry point once that
// exists (e.g. alongside subscription management at public launch).

const NAV = [
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/backtesting", label: "Backtesting", icon: Target },
  { to: "/reviews", label: "Reviews", icon: NotebookPen },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/calendar", label: "Economic Calendar", icon: CalendarClock },
  { to: "/lot-size", label: "Lot Size Calculator (Beta)", icon: Calculator },
  { to: "/settings", label: "Instellingen", icon: Settings },
];

export function Sidebar() {
  const { signOut, isAdmin } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const nav = isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(toErrorMessage(err, "Uitloggen is mislukt"));
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
              aria-label={n.label}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 md:px-3 py-2 rounded-lg font-body text-sm transition-colors shrink-0 ${
                  isActive ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? "text-gold" : "text-muted"} />
                  <span className="hidden md:inline">{n.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="hidden md:flex md:mt-auto flex-col gap-3 px-2">
        <ThemeToggle />
        <button
          onClick={() => void handleSignOut()}
          className="flex items-center gap-2 text-xs font-body text-muted hover:text-ink transition-colors"
        >
          <LogOut size={14} /> Uitloggen
        </button>
      </div>
      <div className="flex items-center gap-1 md:hidden shrink-0">
        <ThemeToggle iconOnly />
        <button
          onClick={() => void handleSignOut()}
          aria-label="Uitloggen"
          className="p-2 rounded-lg text-muted hover:text-ink"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
