import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger as rootLogger } from "@/shared/logger/logger";

const logger = rootLogger.child("error-boundary");

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback. Defaults to a generic full-height message. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error("uncaught render error", {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 surface text-primary px-6 text-center">
        <p className="font-semibold">Something went wrong</p>
        <p className="text-secondary text-sm max-w-sm">{error.message}</p>
        <button
          onClick={this.reset}
          className="rounded-md border border-divider px-4 py-2 text-sm hover:opacity-70 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }
}
