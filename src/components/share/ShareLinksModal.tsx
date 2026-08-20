import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Check, Ban, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  SHARE_EXPIRY_CHOICES, type ShareExpiryChoice,
  expiryFromChoice, revokeShareLink, shareLinkStatus,
} from "@/lib/share/shareLinks";
import { dateLocale } from "@/lib/format";
import { toErrorMessage } from "@/lib/errorMessage";
import type { ShareLink } from "@/lib/types";

const STATUS_CLASS = {
  active: "border-win/50 text-win",
  expired: "border-border text-muted",
  revoked: "border-loss/50 text-loss",
} as const;

/**
 * Generic owner-side share-link management (Fase M, beta-gated by the caller):
 * create a token URL a coach can open without an account, copy it, and revoke
 * it. What the link exposes (journal vs review) is the wrapper's business —
 * ShareJournalModal / ShareReviewModal supply list/create/urlFor plus the copy.
 * The token is a capability — the subtitle says so explicitly, so nobody mails
 * a link around thinking it's login-protected.
 */
export function ShareLinksModal({
  title,
  subtitle,
  list,
  create,
  urlFor,
  onClose,
}: {
  title: string;
  subtitle: string;
  /** Fetches the owner's existing links for this subject, newest first. Called once on mount. */
  list: () => Promise<ShareLink[]>;
  create: (expiresAt: string | null) => Promise<ShareLink>;
  /** Builds the absolute URL a coach opens for one token (journal and review links live on different routes). */
  urlFor: (token: string) => string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<ShareExpiryChoice>(30);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ShareLink | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    list()
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err, t("share.loadLinksFailed")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Fetch once on mount: the modal is opened per subject (journal/review), so
    // `list` can't meaningfully change while it's open — and `t` must not
    // refetch (could race an in-flight revoke), same as before the extraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const link = await create(expiryFromChoice(expiry));
      setLinks((prev) => [link, ...prev]);
      await copyLink(link);
    } catch (err) {
      setError(toErrorMessage(err, t("share.createFailed")));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: ShareLink) {
    try {
      await navigator.clipboard.writeText(urlFor(link.token));
      setCopiedId(link.id);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard can be blocked (permissions/insecure context) — the URL stays
      // visible in the row, so manual selection still works; no error state needed.
    }
  }

  async function confirmRevoke() {
    const link = revoking;
    if (!link) return;
    setRevoking(null);
    setError(null);
    try {
      // Scope-agnostic (updates by id under RLS) — no reason to parameterize per wrapper.
      await revokeShareLink(link.id);
      setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, revoked: true } : l)));
    } catch (err) {
      setError(toErrorMessage(err, t("share.revokeFailed")));
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(dateLocale(i18n.language), { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <>
      <Modal labelledBy="share-links-title" maxWidthClass="max-w-lg" scroll onClose={onClose}>
        {(requestClose) => (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 id="share-links-title" className="font-display text-xl italic text-ink">
                {title}
              </h2>
              <button onClick={requestClose} className="p-1.5 rounded-md hover:bg-ink/5 text-muted">
                <X size={18} />
              </button>
            </div>
            <p className="font-body text-sm text-muted mb-5">{subtitle}</p>

            {error && <p className="font-body text-sm text-loss mb-4">{error}</p>}

            <div className="flex items-end gap-3 mb-5">
              <label className="flex flex-col gap-1.5 font-body text-xs text-muted">
                {t("share.expiryLabel")}
                <select
                  value={expiry === null ? "never" : String(expiry)}
                  onChange={(e) => setExpiry(e.target.value === "never" ? null : (Number(e.target.value) as ShareExpiryChoice))}
                  className="input text-sm py-2"
                >
                  {SHARE_EXPIRY_CHOICES.map((c) => (
                    <option key={c ?? "never"} value={c === null ? "never" : String(c)}>
                      {c === null ? t("share.expiryNever") : t("share.expiryDays", { count: c })}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => void handleCreate()}
                disabled={creating}
                className="flex items-center gap-2 h-9 px-4 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-50"
              >
                <Plus size={15} /> {t("share.createButton")}
              </button>
            </div>

            {loading ? (
              <p className="font-body text-sm text-muted">{t("common.loading")}</p>
            ) : links.length === 0 ? (
              <p className="font-body text-sm text-muted">{t("share.noLinks")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {links.map((link) => {
                  const status = shareLinkStatus(link);
                  const url = urlFor(link.token);
                  return (
                    <li key={link.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_CLASS[status]}`}>
                          {t(`share.status_${status}`)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink" title={url}>
                          {url}
                        </span>
                        {status === "active" && (
                          <>
                            <button
                              onClick={() => void copyLink(link)}
                              title={t("share.copy")}
                              aria-label={t("share.copy")}
                              className="shrink-0 p-1.5 rounded-md text-muted hover:text-ink hover:bg-ink/5"
                            >
                              {copiedId === link.id ? <Check size={14} className="text-win" /> : <Copy size={14} />}
                            </button>
                            <button
                              onClick={() => setRevoking(link)}
                              title={t("share.revoke")}
                              aria-label={t("share.revoke")}
                              className="shrink-0 p-1.5 rounded-md text-muted hover:text-loss hover:bg-ink/5"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <p className="mt-1 font-body text-[11px] text-faint">
                        {t("share.createdOn", { date: formatDate(link.created_at) })} ·{" "}
                        {link.expires_at === null
                          ? t("share.neverExpires")
                          : t("share.expiresOn", { date: formatDate(link.expires_at) })}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Modal>

      {revoking && (
        <ConfirmDialog
          title={t("share.revokeTitle")}
          message={t("share.revokeConfirm")}
          confirmLabel={t("share.revoke")}
          tone="danger"
          onConfirm={() => void confirmRevoke()}
          onClose={() => setRevoking(null)}
        />
      )}
    </>
  );
}
