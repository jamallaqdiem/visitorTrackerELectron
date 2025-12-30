import * as Sentry from "@sentry/electron/renderer"; //  for Electron

/**
 * Global function to log client-side errors to the backend.
 */
export async function logClientError(error, info = {}, type = 'CLIENT_ERROR') {
  if (!error) return;

  // DYNAMIC PORT LOGIC: Uses window.location.origin automatically
  const API_BASE_URL = window.location.port === "5173" 
    ? "http://localhost:3001" 
    : window.location.origin;

  const logData = {
    event_name: type,
    timestamp: new Date().toISOString(),
    status: 'Failed',
    client_message: error.message,
    client_stack: error.stack,
    client_info: JSON.stringify({
      ...info,
      url: window.location.href,
      userAgent: navigator.userAgent,
    }),
  };

  // Log to Console for local debugging
  console.group(`🚨 [${type}] Application Error`);
  console.log(JSON.stringify(logData, null, 2)); 
  console.groupEnd();

  // SENTRY: In Electron, the renderer automatically bubbles up to the Main process.
  // We don't need to check for a DSN here because Main.js already initialized it.
  Sentry.captureException(error, { extra: info });

  try {
    // Send to your Express audit logs
    await fetch(`${API_BASE_URL}/api/audit/log-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logData),
      keepalive: true, 
    });
    console.log(`Error logged to backend successfully: ${type}`);
  } catch (e) {
    console.error('Failed to log error to backend:', e);
  }
}

export default logClientError;