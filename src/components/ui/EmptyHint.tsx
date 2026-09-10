import clsx from "clsx";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface EmptyHintProps {
  /** Already-translated primary line (e.g. "Nog geen reviews."). */
  title: string;
  /** Already-translated one-sentence explanation of what this surface is for. */
  hint: string;
  className?: string;
}

/**
 * Shared empty-state block (E5): a first-time user landing on an empty Reviews /
 * Accounts / Backtesting panel got a lone muted "none yet" with no idea what the
 * surface is for. This pairs that line with one explanation sentence and a link
 * into the Gids (/help), so there's always a next step. Uses `text-muted` (not
 * `text-faint`) for the informative text to keep AA contrast (see E6).
 */
export function EmptyHint({ title, hint, className }: EmptyHintProps) {
  const { t } = useTranslation();
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <p className="text-sm text-muted">{title}</p>
      <p className="text-xs text-muted">{hint}</p>
      <Link to="/help" className="w-fit text-xs text-gold underline-offset-2 hover:underline">
        {t("common.readGuide")} →
      </Link>
    </div>
  );
}
