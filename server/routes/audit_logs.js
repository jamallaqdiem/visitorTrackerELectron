const express = require("express");
const router = express.Router();
const { updateStatus } = require("../status_tracker");

module.exports = (db, logger) => {
  /**
   * POST /api/audit/log-error
   * Logs client-side crashes to the .log file .
   */
  router.post("/log-error", (req, res) => {
    const {
      event_name,
      timestamp,
      client_message,
      client_stack,
      client_info,
    } = req.body;

    // 1. Update the UI Health Status (Memory only)
    updateStatus("last_error", `Client Crash: ${event_name}`);

    // 2. Write to the Winston .log file
    logger.error(`[RENDER_CRASH] ${event_name}: ${client_message}`, {
      time: timestamp,
      stack: client_stack,
      context: client_info
    });

    // 3. Simple success response
    return res.status(200).json({ 
      message: "Crash details saved to log file." 
    });
  });

  /**
   * GET /api/audit/history
   * This uses the DB because it tracks DELETED data (Compliance).
   */
  router.get("/history", (req, res) => {
    const sql = `SELECT * FROM audit_logs ORDER BY timestamp DESC`;
    db.all(sql, [], (err, rows) => {
      if (err) {
        logger.error(`Failed to fetch audit history: ${err.message}`);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(rows);
    });
  });

  return router;
};