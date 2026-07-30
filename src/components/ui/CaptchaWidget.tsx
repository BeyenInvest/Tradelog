import { Turnstile } from "@marsidev/react-turnstile";

interface CaptchaWidgetProps {
  onToken: (token: string | undefined) => void;
}

/**
 * Cloudflare Turnstile widget for the signup/forgot-password forms — Supabase
 * verifies the token server-side when CAPTCHA protection is enabled in the
 * project's Auth settings (Attack Protection). Renders nothing if no site key
 * is configured yet (e.g. before Cloudflare/Supabase are wired up), so those
 * forms still work without blocking on it — see the deploy order in the
 * project's auth rollout plan.
 */
export function CaptchaWidget({ onToken }: CaptchaWidgetProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <Turnstile
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => onToken(undefined)}
      onError={() => onToken(undefined)}
      options={{ theme: "dark" }}
    />
  );
}
