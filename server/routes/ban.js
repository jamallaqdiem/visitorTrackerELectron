const express = require("express");
const router = express.Router();

/**
 * Router to handle banning a visitor.
 * @param {object} db - SQLite database instance.
 * @param {object} logger - Winston logger instance.
 */
module.exports = (db, logger) => {
  router.post("/ban-visitor", (req, res) => {
    const { visitor_id } = req.body;

    if (!visitor_id) {
      logger?.warn("Ban Request: Received request with missing visitor_id.");
      return res.status(400).json({ error: "Visitor ID is required." });
    }

    const sql = `UPDATE visitors SET is_banned = 1 WHERE id = ?`;

    db.run(sql, [visitor_id], function (err) {
      if (err) {
        logger?.error(`Ban Request: Failed to ban visitor ID ${visitor_id} - ${err.message}`);
        return res.status(500).json({ error: "Failed to ban visitor." });
      }

      if (this.changes === 0) {
        logger?.warn(`Ban Request: Attempted to ban non-existent visitor ID ${visitor_id}`);
        return res.status(404).json({ message: "Visitor not found." });
      }

      logger?.info(`Ban Action: Visitor ID ${visitor_id} has been successfully banned.`);
      res.status(200).json({ 
        message: "Visitor has been banned successfully.",
        visitor_id: visitor_id 
      });
    });
  });

  return router;
};