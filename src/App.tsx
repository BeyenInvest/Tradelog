import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AppRouter } from "@/router";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RegisterSW } from "@/components/pwa/RegisterSW";

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <RegisterSW />
            <AppRouter />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
