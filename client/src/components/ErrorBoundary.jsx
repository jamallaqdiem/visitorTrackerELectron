import React from "react";

// Utility to send error details to the backend
import { logClientError } from "./utils/error_logging";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  // 1. Catches error and updates state to trigger fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // 2. Sends error details to the logging service/backend
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log the error to  dedicated service
    logClientError(error, errorInfo, "RENDER_CRASH");

    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-800 p-8">
          <h1 className="text-3xl font-bold mb-4">🚨 Application Error</h1>
          <p className="text-lg text-center">
            Something went wrong. The support team has been notified.
            <br />
            Please try refreshing the page or contact support if the problem
            persists.
          </p>
          {/* Show details only if we aren't in production */}
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 p-4 bg-red-100 rounded text-sm whitespace-pre-wrap max-w-lg">
              <summary>Error Details</summary>
              {this.state.error.toString()}
              <br />
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <button
            onClick={() => (window.location.href = window.location.origin)}
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
