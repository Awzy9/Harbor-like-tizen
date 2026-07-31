import { Component, type ErrorInfo, type ReactNode } from "react";
import "./ErrorBoundary.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | undefined;
}

/**
 * Last line of defense against docs/PROJECT_PLAN.md section 36's "a network
 * failure must never crash the application" — extended here to cover any
 * unexpected render error, not just network ones. Deliberately sits outside
 * FocusProvider (see app/App.tsx) and uses a plain native <button> rather
 * than FocusableItem, so a crash inside the navigation/focus system itself
 * can't also take down its own recovery UI. A native focused button still
 * responds to the remote's Enter key without any of our own JS.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] caught a render error", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: undefined });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary safe-area">
        <h1>Something went wrong</h1>
        <p className="text-dim">{this.state.error.message}</p>
        <button className="error-boundary__button" autoFocus onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
