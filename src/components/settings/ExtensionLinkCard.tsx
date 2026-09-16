import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

/**
 * F1c — "Verbind TradingView-extensie" (plan-tv-extensie-engines §3).
 *
 * Roept `api/extension-link.ts` aan met de eigen Supabase-JWT en toont de
 * teruggegeven `token_hash` als koppelcode. De gebruiker plakt die in het
 * "Verbind"-veld van de extensie-popup, die hem via verifyOtp(magiclink) inwisselt
 * voor een eigen sessie. De code is eenmalig en kortlevend — we bewaren hem dus
 * alleen in component-state, nooit in localStorage of de profielrij.
 *
 * Bewust niet gebouwd: geen "gekoppeld sinds"-status en geen "koppel los"-knop —
 * de app registreert nergens server-side dát een extensie gekoppeld is (de
 * extensie houdt haar eigen refresh-token-familie bij), dus zulke UI zou liegen.
 * Loskoppelen gebeurt in de extensie-popup zelf.
 */
export function ExtensionLinkCard() {
  const { t } = useTranslation();
  const { betaFeatures } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  if (!betaFeatures) return null;

  async function handleGenerate() {
    setError(null);
    setCopied(false);
    setCopyFailed(false);
    setBusy(true);
    try {
      const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      if (!accessToken) {
        setError(t("settings.extensionLinkErrorGeneric"));
        return;
      }
      const res = await fetch("/api/extension-link", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setCode(null);
        if (res.status === 403) setError(t("settings.extensionLinkErrorBeta"));
        else if (res.status === 429) setError(t("settings.extensionLinkErrorRate"));
        else setError(t("settings.extensionLinkErrorGeneric"));
        return;
      }
      const body = (await res.json()) as { token_hash?: string };
      if (!body.token_hash) {
        setCode(null);
        setError(t("settings.extensionLinkErrorGeneric"));
        return;
      }
      setCode(body.token_hash);
    } catch {
      setCode(null);
      setError(t("settings.extensionLinkErrorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopyFailed(false);
      setCopied(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard kan geblokkeerd zijn (permissions/insecure context): selecteer
      // de code zodat handmatig kopiëren één toetsaanslag is.
      setCopied(false);
      setCopyFailed(true);
      codeRef.current?.focus();
      codeRef.current?.select();
    }
  }

  return (
    <Card>
      <p className="font-body text-sm text-ink">{t("settings.extensionLink")}</p>
      <p className="font-mono text-xs mt-1 text-muted">{t("settings.extensionLinkDescription")}</p>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy
            ? t("settings.extensionLinkBusy")
            : code
              ? t("settings.extensionLinkRegenerate")
              : t("settings.extensionLinkCta")}
        </button>
      </div>

      {code && (
        <>
          <div className="flex gap-2 mt-3">
            <input
              ref={codeRef}
              type="text"
              readOnly
              value={code}
              aria-label={t("settings.extensionLinkCodeLabel")}
              onFocus={(e) => e.currentTarget.select()}
              className="input flex-1 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="shrink-0 px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-ink hover:border-gold transition-colors"
            >
              {copied ? t("settings.extensionLinkCopied") : t("settings.extensionLinkCopy")}
            </button>
          </div>
          <p className="font-mono text-[11px] mt-2 text-muted">{t("settings.extensionLinkHint")}</p>
          {copyFailed && (
            <p className="font-mono text-[11px] mt-1 text-muted">{t("settings.extensionLinkCopyFailed")}</p>
          )}
        </>
      )}

      {error && <p className="font-mono text-[11px] mt-3 text-loss">{error}</p>}

      <Link to="/help" className="block w-fit mt-3 text-xs text-gold underline-offset-2 hover:underline">
        {t("common.readGuide")} →
      </Link>
    </Card>
  );
}
