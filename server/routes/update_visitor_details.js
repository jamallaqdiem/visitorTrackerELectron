const express = require("express");

module.exports = (db, logger) => {
  const router = express.Router();

  router.post("/update-visitor-details", (req, res) => {
    const {
      id, known_as, address, phone_number, unit, reason_for_visit,
      type, company_name, mandatory_acknowledgment_taken, additional_dependents,
    } = req.body;

    if (!id) {
      logger?.warn("Update Attempt Failed: Missing Visitor ID.");
      return res.status(400).json({ message: "Visitor ID is required for re-registration." });
    }

    // Use a transaction to ensure data integrity
    db.serialize(() => {
      db.run("BEGIN TRANSACTION;");

      db.get("SELECT id FROM visitors WHERE id = ?", [id], (err, visitorRow) => {
        if (err || !visitorRow) {
          db.run("ROLLBACK;");
          logger?.warn(`Update Failed: Visitor ID ${id} not found.`);
          return res.status(404).json({ message: "Visitor ID not found." });
        }

        const visitsSql = `
          INSERT INTO visits (
            visitor_id, entry_time, known_as, address, phone_number, unit, 
            reason_for_visit, type, company_name, mandatory_acknowledgment_taken
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        const entry_time = new Date().toISOString();

        db.run(visitsSql, [
          id, entry_time, known_as, address, phone_number, 
          unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken,
        ], function (err) {
          if (err) {
            db.run("ROLLBACK;");
            logger?.error(`SQL Error inserting visit for update: ${err.message}`);
            return res.status(500).json({ error: err.message });
          }

          const newVisitId = this.lastID;

          // Handle dependents
          if (additional_dependents) {
            let dependentsArray = [];
            try {
              dependentsArray = typeof additional_dependents === 'string' 
                ? JSON.parse(additional_dependents) 
                : additional_dependents;
            } catch (parseError) {
              logger?.error("Failed to parse dependents JSON.");
              dependentsArray = [{ full_name: additional_dependents, age: null }];
            }

            if (dependentsArray.length > 0) {
              const dependentPromises = dependentsArray.map(dep => 
                new Promise((resolve, reject) => {
                  db.run(
                    `INSERT INTO dependents (full_name, age, visit_id) VALUES (?, ?, ?)`,
                    [dep.full_name, dep.age, newVisitId],
                    (err) => err ? reject(err) : resolve()
                  );
                })
              );

              Promise.all(dependentPromises)
                .then(() => {
                  db.run("COMMIT;");
                  logger?.info(`SUCCESS: Visitor ${id} updated and signed in (Visit ID: ${newVisitId}).`);
                  res.status(201).json({ message: "Visitor Updated and Signed in Successfully!", id: newVisitId });
                })
                .catch((err) => {
                  db.run("ROLLBACK;");
                  logger?.error(`Transaction Failed on dependents: ${err.message}`);
                  res.status(500).json({ error: "Transaction failed." });
                });
              return;
            }
          }

          // No dependents to add
          db.run("COMMIT;");
          logger?.info(`SUCCESS: Visitor ${id} updated (no dependents).`);
          res.status(201).json({ message: "Visitor Updated Successfully & signed in!", id: newVisitId });
        });
      });
    });
  });

  return router;
};