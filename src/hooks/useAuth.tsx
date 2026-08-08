import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, pendingAuthRedirectType } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import i18n from "@/i18n";

interface AuthContextValue {
  session: Session | null;
  /** The signed-in user's own profiles row (role, plan, display_name), fetched once alongside the session. */
  profile: Profile | null;
  isAdmin: boolean;
  /** profile?.hide_fase — user opted out of the fixed 4-fasen system, so every fase-related field/breakdown hides in their own UI. */
  hideFase: boolean;
  loading: boolean;
  /**
   * True from the moment a PASSWORD_RECOVERY auth event fires until sign-out — a hint, not the
   * sole guard (see ResetPasswordPage). Also set for an accepted invite: Supabase fires a plain
   * SIGNED_IN for `type=invite` (no dedicated event), so an invited user would otherwise land in
   * the app fully authenticated with no password ever set. `isInvite` distinguishes the two only
   * for copy — both are gated through the same reset-password flow.
   */
  passwordRecovery: boolean;
  isInvite: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string, captchaToken?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, "hide_fase" | "display_name" | "timezone">>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) return null; // non-fatal — profile is only used for role gating, never blocks core auth
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setProfile(data.session ? await fetchProfile(data.session.user.id) : null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (newSession) void fetchProfile(newSession.user.id).then(setProfile);
      else setProfile(null);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_IN" && pendingAuthRedirectType === "invite") setPasswordRecovery(true);
      if (event === "SIGNED_OUT") setPasswordRecovery(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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

  async function updateProfile(patch: Partial<Pick<Profile, "hide_fase" | "display_name" | "timezone">>) {
    if (!session) throw new Error(i18n.t("auth.notLoggedIn"));
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", session.user.id).select().single();
    if (error) throw error;
    setProfile(data as Profile);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isAdmin: profile?.role === "admin",
        hideFase: profile?.hide_fase ?? false,
        loading,
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
