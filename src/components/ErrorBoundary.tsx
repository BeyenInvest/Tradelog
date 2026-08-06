import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/monitoring";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render-time crashes anywhere below it so one bad screen shows a message instead of a blank page. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary:", error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-bg font-body px-4">
          <div className="w-full max-w-md rounded-xl p-8 bg-surface border border-border flex flex-col items-center gap-4 text-center">
            <AlertTriangle size={28} className="text-loss" />
            <div>
              <h1 className="font-display text-2xl italic text-ink mb-1">Er ging iets mis</h1>
              <p className="text-sm text-muted">
                Er trad een onverwachte fout op. Je gegevens zijn veilig — herlaad de pagina om verder te gaan.
              </p>
            </div>
            <p className="font-mono text-xs text-faint break-all">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold"
            >
              Pagina herladen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
