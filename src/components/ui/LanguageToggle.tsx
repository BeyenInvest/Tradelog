import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Lang } from "@/i18n";

interface LanguageToggleProps {
  /** Compact icon-only variant for the mobile top bar, matching ThemeToggle. */
  iconOnly?: boolean;
}

/** Two-language switch (NL ⇆ EN); the label shows the language you'll switch to, like ThemeToggle shows the target theme. */
export function LanguageToggle({ iconOnly = false }: LanguageToggleProps) {
  const { i18n, t } = useTranslation();
  const target: Lang = i18n.language === "nl" ? "en" : "nl";
  const label = t(`language.${target}`);

  function switchLang() {
    void i18n.changeLanguage(target);
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={switchLang}
        aria-label={label}
        title={label}
        className="p-2 rounded-lg text-muted hover:text-ink transition-colors"
      >
        <Languages size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={switchLang}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 text-xs font-body text-muted hover:text-ink transition-colors"
    >
      <Languages size={14} /> {label}
    </button>
  );
}
