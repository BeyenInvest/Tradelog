import type { ReactNode } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";

/**
 * A large, tappable habit row — the whole row toggles. Shared by the Today view
 * and the calendar's per-day editor so a habit looks and behaves identically
 * whether ticked for today or backfilled on another day.
 */
export function HabitCheckbox({
  label,
  checked,
  onToggle,
  accent = false,
  disabled = false,
  trailing,
}: {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  /** Floor habits (keystone/journal) get slightly stronger label weight. */
  accent?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      disabled={disabled}
      aria-pressed={checked}
      className={clsx(
        "flex items-center gap-3 w-full text-left px-3 py-3 rounded-lg border transition-colors disabled:opacity-60",
        checked ? "bg-gold/10 border-gold/50" : "bg-surface-2 border-border hover:border-gold/40"
      )}
    >
      <span
        className={clsx(
          "flex items-center justify-center h-6 w-6 shrink-0 rounded-md border",
          checked ? "bg-gold border-gold text-on-gold" : "border-border text-transparent"
        )}
      >
        <Check size={16} strokeWidth={3} />
      </span>
      <span className={clsx("flex-1 text-sm", accent ? "text-ink font-medium" : "text-ink")}>{label}</span>
      {trailing}
    </button>
  );
}
