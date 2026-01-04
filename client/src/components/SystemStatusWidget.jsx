import React, { useState, useEffect, useCallback } from "react";
import Tooltip from "./Tooltip";

const StatusLine = ({ label, value, isGood }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs">
    <span className="text-gray-500 font-medium">{label}</span>
    <span className={`font-bold ${isGood ? "text-green-600" : "text-red-600"}`}>
      {value}
    </span>
  </div>
);

const SystemStatusWidget = () => {
  const [status, setStatus] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // 1. DYNAMIC FETCH LOGIC
  const fetchStatus = useCallback(async () => {
    try {
      // Use  universal logic
      const API_BASE_URL =
        window.location.port === "5173"
          ? "http://localhost:3001"
          : window.location.origin;

      const response = await fetch(`${API_BASE_URL}/api/status`);
      if (!response.ok) throw new Error("Backend Offline");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("Status check failed:", error);
      setStatus({
        db_ready: false,
        last_error: "Connection to local server failed.",
      });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, 15000);
    return () => clearInterval(intervalId);
  }, [fetchStatus]);

  const fullDiagnosticData = {
    timestamp: new Date().toISOString(),
    status: status,
    app_context: "Electron Desktop App",
    client: {
      url: window.location.href,
      agent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
    },
  };

  const handleCopyToClipboard = async () => {
    try {
      const textToCopy = JSON.stringify(fullDiagnosticData, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      alert("Diagnostic Data copied! Please send this to the IT Support team.");
    } catch (err) {
      alert("Failed to copy automatically.");
    }
  };

  return (
    <>
      {/* --- FLOATING WIDGET --- */}
      <div className="fixed bottom-4 left-4 w-72 bg-white rounded-lg shadow-2xl border border-gray-200 z-40 transition-all">
        <div
          className="bg-slate-800 text-white p-3 flex justify-between items-center cursor-pointer hover:bg-slate-700 rounded-t-lg"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-sm font-bold flex items-center">
            <span
              className={`w-2.5 h-2.5 rounded-full mr-2 ${
                status.db_ready ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></span>
            System Health
          </h3>
          <Tooltip text="Green means the system is healthy. Red means there is a connection issue with the database."></Tooltip>
          <span className="text-[10px] font-mono opacity-70">
            {isExpanded ? "CLOSE ▲" : "VIEW ▼"}
          </span>
        </div>

        {isExpanded && (
          <div className="p-4 border-t border-gray-100 bg-white rounded-b-lg">
            <StatusLine
              label="Local Database"
              value={status.db_ready ? "Connected" : "Disconnected"}
              isGood={status.db_ready}
            />
            <StatusLine
              label="Auto-Backup"
              value={
                status.last_backup && !isNaN(Date.parse(status.last_backup))
                  ? new Date(status.last_backup).toLocaleTimeString()
                  : "Pending"
              }
              isGood={!!status.last_backup}
            />

            {status.last_error && (
              <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] rounded border border-red-100 break-words font-mono">
                <strong>Latest Alert:</strong> {status.last_error}
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              className="mt-4 w-full py-2 bg-slate-100 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-200 transition uppercase tracking-wider"
            >
              System Diagnostics
            </button>
          </div>
        )}
      </div>

      {/* --- DIAGNOSTIC MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-300">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold text-gray-800">
                Support Diagnostics
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-black"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 uppercase tracking-tighter">
              Generated: {new Date().toLocaleString()}
            </p>

            <div className="bg-gray-900 text-blue-300 p-4 rounded-lg font-mono text-[11px] overflow-auto max-h-80 shadow-inner border border-gray-700">
              <pre>{JSON.stringify(fullDiagnosticData, null, 2)}</pre>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:underline"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button
                className="px-6 py-2 bg-blue-600 text-white rounded-md text-sm font-bold hover:bg-blue-700 shadow-md"
                onClick={handleCopyToClipboard}
              >
                Copy for IT Support
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SystemStatusWidget;
