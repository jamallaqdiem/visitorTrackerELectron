const express = require("express");
/**

 * Creates and configures a router for handling visitor unbanning.
 * This endpoint requires a master password for authorization.
 *
 * @param {object} db - The SQLite database instance.
 * @returns {express.Router} - An Express router with the unban endpoint.
 */

module.exports = (db, logger,ADMIN_PASSWORD_2) => {
  const router = express.Router();

  router.post("/unban-visitor/:id", (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

   // Use the password passed in from the config.json
    if (!password || password !== ADMIN_PASSWORD_2) {
      logger?.warn(`Security: Unauthorized unban attempt for Visitor ID ${id}.`);
      return res.status(403).json({ message: "Incorrect password." });
    }

    const sql = `UPDATE visitors SET is_banned = 0 WHERE id = ?`;
    db.run(sql, [id], function (err) {
      if (err) {
        logger?.error(`SQL Error unbanning visitor: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        logger?.warn(`Unban Failed: Visitor ID ${id} not found.`);
        return res.status(404).json({ message: "Visitor not found." });
      }

      logger?.info(`SUCCESS: Visitor ID ${id} has been unbanned.`);
      res.status(200).json({ message: `Visitor has been unbanned successfully.` });
    });
  });

  return router;
};