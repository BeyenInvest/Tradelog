import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Target, BookOpen, NotebookPen, Wallet, CalendarClock, Calculator, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BullBearLogo } from "@/components/ui/BullBearLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { toErrorMessage } from "@/lib/errorMessage";

const NAV = [
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/backtesting", label: "Backtesting", icon: Target },
  { to: "/reviews", label: "Reviews", icon: NotebookPen },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/calendar", label: "Economic Calendar", icon: CalendarClock },
  { to: "/lot-size", label: "Lot Size Calculator (Beta)", icon: Calculator },
];

export function Sidebar() {
  const { signOut, deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    if (
      !confirm(
        "Account definitief verwijderen? Al je trades, reviews, backtestprojecten en accountgegevens worden permanent gewist. Dit kan niet ongedaan worden gemaakt.",
      )
    ) {
      return;
    }
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError(toErrorMessage(err, "Verwijderen van account is mislukt"));
      setDeleting(false);
    }
  }

  return (
    <aside className="w-full md:w-56 md:shrink-0 flex flex-row md:flex-col items-center md:items-stretch justify-between py-3 md:py-6 px-4 border-b md:border-b-0 md:border-r border-border md:overflow-y-auto">
      <div className="flex items-center gap-2 md:px-2 md:mb-8">
        <BullBearLogo size={20} className="text-gold" />
        <span className="hidden sm:inline font-display text-2xl italic tracking-wide text-ink">Beyen Invest</span>
      </div>

      <nav className="flex flex-row md:flex-col gap-1">
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 md:px-3 py-2 rounded-lg font-body text-sm transition-colors ${
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
          onClick={() => void signOut()}
          className="flex items-center gap-2 text-xs font-body text-muted hover:text-ink transition-colors"
        >
          <LogOut size={14} /> Uitloggen
        </button>
        <button
          onClick={() => void handleDeleteAccount()}
          disabled={deleting}
          className="flex items-center gap-2 text-xs font-body text-muted hover:text-loss transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} /> {deleting ? "Bezig met verwijderen..." : "Account verwijderen"}
        </button>
        {deleteError && <p className="text-[11px] text-loss">{deleteError}</p>}
      </div>
      <div className="flex items-center gap-1 md:hidden">
        <ThemeToggle iconOnly />
        <button onClick={() => void signOut()} className="p-2 rounded-lg text-muted hover:text-ink">
          <LogOut size={16} />
        </button>
        <button
          onClick={() => void handleDeleteAccount()}
          disabled={deleting}
          className="p-2 rounded-lg text-muted hover:text-loss disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </aside>
  );
}
