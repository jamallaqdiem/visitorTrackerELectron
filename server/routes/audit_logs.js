const express = require("express");
const router = express.Router();
// Ensure we are importing the object to allow Jest spying in tests
const statusTracker = require("../status_tracker");

module.exports = (db, logger) => {
    /**
     * POST /api/audit/log-error
     * Logs client-side crashes to the .log file AND validates input.
     */
    router.post("/log-error", (req, res) => {
        const {
            event_name,
            timestamp,
            status,
            client_message,
            client_stack,
            client_info,
        } = req.body;

        // 1. Validation 
        if (!event_name || !timestamp || !status) {
            logger?.warn("Audit: Rejected log-error due to missing fields.");
            return res.status(400).json({ error: "Missing required fields" });
        }

        try {
            // 2. Update UI Health (Using the object property so Jest spyOn works)
            statusTracker.updateStatus("last_error", `Client Crash: ${event_name}`);

            // 3. Write to the Winston .log file
            logger.error(`[RENDER_CRASH] ${event_name}: ${client_message || 'No message'}`, {
                time: timestamp,
                stack: client_stack,
                context: client_info
            });

            return res.status(201).json({ 
                message: "Client error logged successfully" 
            });
        } catch (err) {
            // 4. Return 202 if the logic above crashes (e.g., during the spyOn test)
            return res.status(202).json({ 
                message: "backend insertion failed",
                error: err.message
            });
        }
    });

    /**
     * GET /api/audit/history
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