import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  /** Compact icon-only variant for the mobile top bar, matching the logout icon button. */
  iconOnly?: boolean;
}

export function ThemeToggle({ iconOnly = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const label = isLight ? "Donkere modus" : "Lichte modus";
  const Icon = isLight ? Moon : Sun;

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={label}
        title={label}
        className="p-2 rounded-lg text-muted hover:text-ink transition-colors"
      >
        <Icon size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 text-xs font-body text-muted hover:text-ink transition-colors"
    >
      <Icon size={14} /> {label}
    </button>
  );
}
