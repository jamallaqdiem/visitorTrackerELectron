const express = require("express");

/**
 * Creates and configures a router for handling visitor-related data.
 */
function createVisitorsRouter(db, logger) {
  const router = express.Router();

  // Endpoint to get all currently signed-in visitors (exit_time is NULL)
  router.get("/visitors", (req, res) => {
    const query = `
    SELECT
        T1.id, T1.first_name, T1.last_name, T1.photo_path, T1.is_banned,
        T2.entry_time, T2.exit_time, T2.known_as, T2.address, T2.phone_number,
        T2.unit, T2.reason_for_visit, T2.company_name, T2.type,
        T2.mandatory_acknowledgment_taken,
        GROUP_CONCAT(json_object('full_name', T3.full_name, 'age', T3.age)) AS additional_dependents
    FROM visitors AS T1
    JOIN visits AS T2 ON T1.id = T2.visitor_id
    LEFT JOIN dependents AS T3 ON T2.id = T3.visit_id
    WHERE T2.exit_time IS NULL
    GROUP BY T1.id, T2.entry_time
    ORDER BY T2.entry_time DESC
`;

    db.all(query, [], (err, rows) => {
      if (err) {
        logger?.error(`SQL Error fetching signed-in visitors: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }

      logger?.info(`Dashboard: Fetched ${rows.length} currently signed-in visitors.`);

      const resultsWithUrls = rows.map((row) => ({
        ...row,
        photo: row.photo_path || null,
      }));

      res.json(resultsWithUrls);
    });
  });

  return router;
}

module.exports = createVisitorsRouter;