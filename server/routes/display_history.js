const express = require("express");

/**
 * Creates and configures a router for fetching historical visitor data.
 * @param {object} db - The SQLite database instance.
 * @param {object} logger - Winston logger instance.
 *  @param {string} ADMIN_PASSWORD_1 - The password from config.json
 */
function createHistoryRouter(db, logger,ADMIN_PASSWORD_1) {
  const router = express.Router();
  
  // Endpoint to authorize admin view
  router.post("/authorize-history", (req, res) => {
    const { password } = req.body;

    if (password && password=== ADMIN_PASSWORD_1) {
      logger?.info("Admin Authorization: Successful login to history dashboard.");
      return res.status(200).json({ success: true, message: "Authorization successful." });
    } else {
      logger?.warn("Admin Authorization: Failed login attempt with incorrect password.");
      return res.status(403).json({ message: "Incorrect password." });
    }
  });

  // Endpoint to get all historical visits with optional filtering
  router.get("/history", (req, res) => {
    const { search, start_date, end_date } = req.query;

    let whereClauses = [];
    let queryParams = [];
    if (search) {
      const searchParam = `%${search.toLowerCase()}%`;
      whereClauses.push(`(LOWER(T1.first_name) LIKE ? OR LOWER(T1.last_name) LIKE ?)`);
      queryParams.push(searchParam, searchParam);
    }

    if (start_date) {
      whereClauses.push(`T2.entry_time >= ?`);
      queryParams.push(start_date);
    }
    if (end_date) {
      const endOfDay = `${end_date}T23:59:59Z`;
      whereClauses.push(`T2.entry_time <= ?`);
      queryParams.push(endOfDay);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
        SELECT
            T1.id AS visitor_id, T1.first_name, T1.last_name, T1.photo_path, T1.is_banned,
            T2.id AS visit_id, T2.known_as, T2.entry_time, T2.exit_time, T2.address,
            T2.phone_number, T2.unit, T2.reason_for_visit, T2.company_name, T2.type,
            T2.mandatory_acknowledgment_taken,
            GROUP_CONCAT('{' || '"full_name":"' || T3.full_name || '",' || '"age":' || T3.age || '}') AS additional_dependents_json
        FROM visitors AS T1
        JOIN visits AS T2 ON T1.id = T2.visitor_id
        LEFT JOIN dependents AS T3 ON T2.id = T3.visit_id
        ${whereClause}
        GROUP BY T1.id, T2.id
        ORDER BY T2.entry_time DESC
    `;

    db.all(query, queryParams, (err, rows) => {
      if (err) {
        logger?.error(`History Query Error: ${err.message}`);
        return res.status(500).json({ error: "Failed to retrieve historical data." });
      }

      const results = rows.map((row) => {
        let dependents = [];
        if (row.additional_dependents_json) {
          try {
            // Fix for SQL GROUP_CONCAT which doesn't wrap in brackets
            dependents = JSON.parse(`[${row.additional_dependents_json}]`);
          } catch (e) {
            logger?.warn(`History: Failed to parse dependents for visit ${row.visit_id}`);
          }
        }

        return {
          ...row,
          photo: row.photo_path ? `${req.protocol}://${req.get("host")}/${row.photo_path}` : null,
          dependents: dependents,
          photo_path: undefined,
          additional_dependents_json: undefined,
        };
      });

      logger?.info(`History Query: Returned ${results.length} records (Search: "${search || 'none'}")`);
      res.json(results);
    });
  });

  return router;
}

module.exports = createHistoryRouter;