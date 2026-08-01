import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    console.error("Error no controlado en la UI:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark p-5">
          <div className="card max-w-md text-center">
            <h2 className="text-lg font-semibold mb-2">Algo salió mal</h2>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark mb-4">
              {this.state.error.message}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
