import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/layout/AppShell";
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

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, passwordRecovery } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg">
        <p className="font-mono text-sm text-muted">Laden...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  // An accepted invite lands here fully authenticated but with no password ever set (Supabase
  // fires a plain SIGNED_IN for invites — see useAuth). Route through the same "set a password"
  // gate as an in-progress recovery before letting either into the app.
  if (passwordRecovery) return <Navigate to="/reset-password" replace />;
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
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
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
