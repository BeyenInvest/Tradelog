import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MethodologyProvider } from "@/hooks/useMethodology";
import { ResultDisplayProvider } from "@/hooks/useResultDisplay";
import { AppShell } from "@/components/layout/AppShell";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { FullScreenLoading } from "@/components/ui/FullScreenLoading";
import { ProfileErrorScreen } from "@/components/ui/ProfileErrorScreen";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";

// The authenticated app pages are code-split: they (and the recharts/heavy
// deps they pull in) load only once a signed-in user navigates to them, keeping
// the initial login bundle small. The public/auth pages above stay eager — one
// of them is always the first paint for a logged-out visitor.
const JournalPage = lazy(() => import("@/pages/JournalPage"));
const ProjectsListPage = lazy(() => import("@/pages/ProjectsListPage"));
const ProjectDashboardPage = lazy(() => import("@/pages/ProjectDashboardPage"));
const ReviewsPage = lazy(() => import("@/pages/ReviewsPage"));
const AccountsPage = lazy(() => import("@/pages/AccountsPage"));
const EconomicCalendarPage = lazy(() => import("@/pages/EconomicCalendarPage"));
const LotSizeCalculatorPage = lazy(() => import("@/pages/LotSizeCalculatorPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AdminUsersListPage = lazy(() => import("@/pages/AdminUsersListPage"));
const AdminUserDetailPage = lazy(() => import("@/pages/AdminUserDetailPage"));
// Public but lazy: the share view pulls in the charts/stats bundle, and it's never
// the first paint for a normal visitor — a coach opening a token-URL gets the same
// brief loading state the app pages show. Outside AppShell, so it needs its own Suspense.
const SharePage = lazy(() => import("@/pages/SharePage"));
const ShareReviewPage = lazy(() => import("@/pages/ShareReviewPage"));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, profileError, loading, passwordRecovery } = useAuth();

  if (loading) return <FullScreenLoading />;

  if (!session) return <Navigate to="/login" replace />;
  // An accepted invite lands here fully authenticated but with no password ever set (Supabase
  // fires a plain SIGNED_IN for invites — see useAuth). Route through the same "set a password"
  // gate as an in-progress recovery before letting either into the app.
  if (passwordRecovery) return <Navigate to="/reset-password" replace />;
  // A profile that FAILED to load is FATAL, not something to render past (audit
  // blocker N1): without it the active journal is unknowable and new trades
  // would silently land in the `null`-journal. Retry or sign out — nothing else.
  if (profileError) return <ProfileErrorScreen />;
  // Signed in but the profile fetch is still in flight: on an in-app sign-in the
  // onAuthStateChange handler kicks off loadProfile without awaiting (loading is
  // already false by then), so `profile` is briefly null with no error yet. Show
  // the loading state, not the fatal error screen — otherwise it flashes for a frame.
  if (!profile) return <FullScreenLoading />;
  return <>{children}</>;
}

/** Nested inside ProtectedRoute, so session/loading are already handled — only the role check is new here. */
function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/journal" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      {/* Read-only journal behind a share-link token (Fase M) — no account, no auth gate.
          The token is the capability; validation happens in the get_shared_journal RPC. */}
      {/* /share/review vóór /share/:token, anders vangt de token-route het woord "review". */}
      <Route
        path="/share/review/:token"
        element={
          <Suspense fallback={<FullScreenLoading />}>
            <ShareReviewPage />
          </Suspense>
        }
      />
      <Route
        path="/share/:token"
        element={
          <Suspense fallback={<FullScreenLoading />}>
            <SharePage />
          </Suspense>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            {/* Session is guaranteed here — the shared methodology state (one
                fetch for the whole app) can safely read the profile. */}
            <MethodologyProvider>
              <ResultDisplayProvider>
                <AppShell />
                {/* First-run onboarding (Fase N4) — a one-time overlay above the
                    shell, route-independent. Renders null unless it should show. */}
                <OnboardingWizard />
              </ResultDisplayProvider>
            </MethodologyProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/journal" replace />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/backtesting" element={<ProjectsListPage />} />
        <Route path="/backtesting/:projectId" element={<ProjectDashboardPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/calendar" element={<EconomicCalendarPage />} />
        <Route path="/lot-size" element={<LotSizeCalculatorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminUsersListPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users/:userId"
          element={
            <AdminRoute>
              <AdminUserDetailPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/journal" replace />} />
      </Route>
    </Routes>
  );
}
