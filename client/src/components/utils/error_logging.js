import * as Sentry from "@sentry/electron/renderer"; 

/**
 * Global function to log client-side errors to the backend.
 */
export async function logClientError(error, info = {}, type = 'CLIENT_ERROR') {
  if (!error) return;

// Use the dynamic port caught by App.jsx, or fallback to 3001
  const baseUrl = window.API_BASE_URL || "http://localhost:3001";
  
  const logData = {
    event_name: type,
    timestamp: new Date().toISOString(),
    status: 'Failed',
    client_message: error.message,
    client_stack: error.stack,
  };

  // Log to Console for local debugging
  console.group(`🚨 [${type}] Application Error`);
  console.log(JSON.stringify(logData, null, 2)); 
  console.groupEnd();

  // SENTRY: In Electron, the renderer automatically bubbles up to the Main process.
  // We don't need to check for a DSN here because Main.js already initialized it.
  Sentry.captureException(error, { extra: info });

  try {
    // Send to Express audit logs
    await fetch(`${baseUrl}/api/audit/log-error`, {
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