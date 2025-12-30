import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import * as Sentry from "@sentry/electron/renderer"; // CRITICAL: Use electron renderer
import { logClientError } from './components/utils/error_logging';

// It automatically inherits it from the Main process we configured .
Sentry.init({
  sendDefaultPii: false,
  //  keep the basic masking for privacy.
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Console Error Interceptor (for logs)
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (typeof message === 'string' && message.includes('validateDOMNesting')) {
    logClientError(
      new Error(`DOM Nesting Warning: ${message}`),
      { component: 'Table/History' },
      'REACT_DOM_WARNING'
    );
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);