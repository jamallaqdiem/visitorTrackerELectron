const express = require("express");

module.exports = (db, logger) => {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const { id } = req.body;
    const entry_time = new Date().toISOString();

    if (!id) {
      logger?.warn("Login attempt failed: Missing visitor ID in request body (400).");
      return res.status(400).json({ message: "Visitor ID is required for login." });
    }

    // SQL to get visitor and latest visit info
    const findSql = `
      SELECT 
        v.id, v.is_banned,
        vis.known_as, vis.address, vis.phone_number, vis.unit, 
        vis.reason_for_visit, vis.type, vis.company_name, 
        vis.mandatory_acknowledgment_taken,
        (SELECT GROUP_CONCAT(full_name || '|' || age) FROM dependents WHERE visit_id = vis.id) as dependents_raw
      FROM visitors v
      LEFT JOIN visits vis ON v.id = vis.visitor_id
      WHERE v.id = ?
      ORDER BY vis.entry_time DESC
      LIMIT 1
    `;

    db.get(findSql, [id], (err, row) => {
      if (err) {
        logger?.error(`SQL Error in login: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }

      if (!row) {
        logger?.warn(`Login failed for ID ${id}: Visitor not found (404).`);
        return res.status(404).json({ message: "Visitor not found." });
      }

      if (row.is_banned === 1) {
        logger?.warn(`Login attempt by banned visitor ID ${id} blocked (403 Forbidden).`);
        return res.status(403).json({ message: "This visitor is banned and cannot log in." });
      }

      let dependentsData = [];
      if (row.dependents_raw) {
        dependentsData = row.dependents_raw.split(',').map(item => {
          const [name, age] = item.split('|');
          return { full_name: name, age: parseInt(age) };
        });
      }

      const insertSql = `
        INSERT INTO visits (visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [id, entry_time, row.known_as, row.address, row.phone_number, row.unit, row.reason_for_visit, row.type, row.company_name, row.mandatory_acknowledgment_taken];

      db.run(insertSql, params, function (err) {
        if (err) {
          logger?.error(`SQL Error inserting new visit: ${err.message}`);
          return res.status(500).json({ error: err.message });
        }

        const newVisitId = this.lastID;
        
        // Clone dependents
        if (dependentsData.length > 0) {
          const depSql = `INSERT INTO dependents (visit_id, full_name, age) VALUES (?, ?, ?)`;
          dependentsData.forEach(d => {
            db.run(depSql, [newVisitId, d.full_name, d.age], (depErr) => {
              if (depErr) logger?.error(`SQL Error inserting dependent for Visit ID ${newVisitId}: ${depErr.message}`);
            });
          });
        }

        logger?.info(`SUCCESS: Visitor ID ${id} signed in successfully. New Visit ID: ${newVisitId}.`);
        
        res.status(200).json({
          message: "Visitor signed in successfully!",
          visitorData: { ...row, dependents: dependentsData }
        });
      });
    });
  });

  return router;
};