import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, pendingAuthRedirectType } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import type { ResultUnit } from "@/lib/constants";
import i18n from "@/i18n";

interface AuthContextValue {
  session: Session | null;
  /** The signed-in user's own profiles row (role, plan, display_name), fetched once alongside the session. */
  profile: Profile | null;
  isAdmin: boolean;
  /** profile?.hide_fase — user opted out of the fixed 4-fasen system, so every fase-related field/breakdown hides in their own UI. */
  hideFase: boolean;
  /**
   * The soft-launch gate for every in-development feature (multi-journal UI, presets, editor,
   * direction, Fase-E stats, onboarding, …). True when the user has `profile.beta_features` set,
   * OR is an admin, OR is the owner account — so the owner always sees the beta surface without a
   * DB flip, and no current end-user ever does until public launch. Every new/unfinished feature
   * MUST gate on this so it stays away from the live users. (Was: raw `profile.beta_features`.)
   */
  betaFeatures: boolean;
  /**
   * profile?.result_unit — hoe deze gebruiker resultaten getoond wil zien (%, R of
   * geld; Fase J / 0037). Puur een weergave-voorkeur: stats rekenen altijd in %.
   */
  resultUnit: ResultUnit;
  loading: boolean;
  /**
   * True from the moment a PASSWORD_RECOVERY auth event fires until sign-out — a hint, not the
   * sole guard (see ResetPasswordPage). Also set for an accepted invite: Supabase fires a plain
   * SIGNED_IN for `type=invite` (no dedicated event), so an invited user would otherwise land in
   * the app fully authenticated with no password ever set. `isInvite` distinguishes the two only
   * for copy — both are gated through the same reset-password flow.
   */
  /**
   * True when the last profile fetch failed (audit blocker N1). A signed-in user
   * always has a profiles row (auto-provisioned), so a missing/failed profile
   * means the active journal is unknowable — the router blocks the app behind a
   * retry screen instead of rendering with `methodology_id` silently null, which
   * would misfile every new trade into the `null`-journal.
   */
  profileError: boolean;
  /** Re-attempts the profile fetch after a failure (the retry screen's button). */
  retryProfile: () => Promise<void>;
  passwordRecovery: boolean;
  isInvite: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string, captchaToken?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "hide_fase" | "display_name" | "timezone" | "methodology_id" | "result_unit" | "onboarded_at">>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owner accounts that always get the beta surface, regardless of the profiles.beta_features flag.
 * Keeps in-development features visible to the owner while staying hidden from the live users,
 * without needing a DB flip. Compared case-insensitively against the signed-in email.
 */
const OWNER_BETA_EMAILS = ["superrrdun@gmail.com"];

/**
 * The profile is load-bearing (active journal, role, display prefs) — a failed
 * fetch is FATAL for the app shell, not something to render past (audit blocker
 * N1; the old "non-fatal — only role gating" comment predated multi-journal).
 * A missing row counts as failure too: every signed-in user has one
 * (auto-provisioned by handle_new_user), so absence means something is wrong.
 */
async function fetchProfile(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error || !data) return { profile: null, failed: true };
  return { profile: data as Profile, failed: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // Same guard as useTrades' requestIdRef (M3): profile fetches fire from
  // getSession, every onAuthStateChange (token refreshes included), retryProfile
  // and updateProfile — a slow older response must not land after a newer one and
  // resurrect a stale profile (e.g. the journal you just switched away from).
  const profileSeqRef = useRef(0);

  // Applies a fetch result WITHOUT clobbering a previously loaded profile on
  // failure: onAuthStateChange refetches on every token refresh, and a
  // transient network error there must not null out good state mid-session
  // (that would misfile the next trade save — audit blocker N1). Only a
  // never-loaded profile leaves the app behind the retry screen.
  async function loadProfile(userId: string) {
    const seq = ++profileSeqRef.current;
    const res = await fetchProfile(userId);
    if (seq !== profileSeqRef.current) return; // superseded by a newer fetch/update
    setProfileError(res.failed);
    if (!res.failed) setProfile(res.profile);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) void loadProfile(newSession.user.id);
      else {
        profileSeqRef.current += 1; // an in-flight fetch must not re-apply a profile after sign-out
        setProfile(null);
        setProfileError(false);
      }
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_IN" && pendingAuthRedirectType === "invite") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
    });

    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retryProfile() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await loadProfile(data.session.user.id);
  }

  async function signIn(email: string, password: string, captchaToken?: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function signUp(email: string, password: string, displayName: string, captchaToken?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        emailRedirectTo: `${window.location.origin}/login`,
        // handle_new_user() (schema.sql) copies this into profiles.display_name at signup.
        data: { display_name: displayName.trim() },
      },
    });
    if (error) throw error;
    // Email confirmation is required project-side, so a fresh signup returns a
    // user with no session yet — that's the "check your email" case, not an error.
    return { needsEmailConfirmation: data.session === null };
  }

  async function sendPasswordReset(email: string, captchaToken?: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    });
    if (error) throw error;
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordRecovery(false);
  }

  async function deleteAccount() {
    const { error } = await supabase.rpc("delete_own_account");
    if (error) throw error;
    await signOut();
  }

  async function updateProfile(patch: Partial<Pick<Profile, "hide_fase" | "display_name" | "timezone" | "methodology_id" | "result_unit" | "onboarded_at">>) {
    if (!session) throw new Error(i18n.t("auth.notLoggedIn"));
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", session.user.id).select().single();
    if (error) throw error;
    profileSeqRef.current += 1; // this row is now fresher than any in-flight fetch
    setProfile(data as Profile);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isAdmin: profile?.role === "admin",
        hideFase: profile?.hide_fase ?? false,
        betaFeatures:
          (profile?.beta_features ?? false) ||
          profile?.role === "admin" ||
          OWNER_BETA_EMAILS.includes((session?.user.email ?? "").toLowerCase()),
        resultUnit: profile?.result_unit ?? "percent",
        loading,
        profileError,
        retryProfile,
        passwordRecovery,
        isInvite: pendingAuthRedirectType === "invite",
        signIn,
        signOut,
        signUp,
        sendPasswordReset,
        updatePassword,
        updateProfile,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
