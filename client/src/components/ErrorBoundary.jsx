import React from "react";
import * as Sentry from "@sentry/electron/renderer"; 
import { logClientError } from "./utils/error_logging"; 

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // A. Log to Backend .log file (Local)
    logClientError(error, errorInfo, "RENDER_CRASH");

    // B. Log to Sentry (Remote)
    // captureException sends the error to dashboard immediately
    Sentry.captureException(error, { extra: errorInfo });

    console.error("Uncaught UI error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-800 p-8">
          <h1 className="text-3xl font-bold mb-4">🚨 Application Error</h1>
          <p className="text-lg text-center">
            Something went wrong. The error has been recorded.
            <br />
            Please click the button below to return to the dashboard.
          </p>
          
          {/* Detailed Error for Developers */}
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 p-4 bg-red-100 rounded text-sm whitespace-pre-wrap max-w-lg text-left">
              <summary className="font-bold cursor-pointer">Debug Info</summary>
              <div className="mt-2">
                <strong>Error:</strong> {this.state.error.toString()}
                <br />
                <strong>Stack:</strong> {this.state.errorInfo?.componentStack}
              </div>
            </details>
          )}

          <button
            onClick={() => window.location.reload()} // Simple refresh is often better
            className="mt-6 px-6 py-2 bg-red-600 text-white font-semibold rounded shadow-md hover:bg-red-700 transition-colors"
          >
            Refresh & Restart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;