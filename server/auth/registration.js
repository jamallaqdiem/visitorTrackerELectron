const express = require("express");
const multer = require("multer");

/**
 * Creates and configures a router for handling new visitor registrations.
 *
 * @param {object} db - The SQLite database instance.
 * @param {object} upload - Multer instance for file handling.
 * @param {object} logger - Winston logger instance.
 * @returns {express.Router} - An Express router with the registration endpoint.
 */
function createRegistrationRouter(db, upload, logger) {
  const router = express.Router();

  // Handle visitor registration
  router.post("/register-visitor", upload.single("photo"), (req, res) => {
    const {
      first_name,
      last_name,
      known_as,
      address,
      phone_number,
      unit,
      reason_for_visit,
      type,
      company_name,
      mandatory_acknowledgment_taken,
      additional_dependents,
    } = req.body;

    const photo_path = req.file ? `uploads/${req.file.filename}` : null;

    // SQL to check if a visitor with the same full name exists
    const checkSql = `SELECT id FROM visitors WHERE first_name = ? AND last_name = ?`;

    db.get(checkSql, [first_name, last_name], (err, row) => {
      if (err) {
        logger?.error(`Registration: Duplicate check failed for ${first_name} ${last_name} - ${err.message}`);
        return res.status(500).json({ error: err.message });
      }

      if (row) {
        logger?.warn(`Registration: Attempted duplicate registration for ${first_name} ${last_name}`);
        const message = `A visitor named ${first_name} ${last_name} already exists. Please use the search bar to log them in.`;
        return res.status(409).json({ message });
      }

      db.run("BEGIN TRANSACTION;");

      const visitorSql = `INSERT INTO visitors (first_name, last_name, photo_path) VALUES (?, ?, ?)`;
      db.run(visitorSql, [first_name, last_name, photo_path], function (err) {
        if (err) {
          logger?.error(`Registration: Failed to insert visitor record: ${err.message}`);
          db.run("ROLLBACK;");
          return res.status(500).json({ error: err.message });
        }
        
        const visitorId = this.lastID;
        const entry_time = new Date().toISOString();

        const visitsSql = `
          INSERT INTO visits (
            visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(
          visitsSql,
          [visitorId, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken],
          function (err) {
            if (err) {
              logger?.error(`Registration: Failed to insert visit record for visitor ID ${visitorId}: ${err.message}`);
              db.run("ROLLBACK;");
              return res.status(500).json({ error: err.message });
            }
            
            const visitId = this.lastID;

            // Handle Dependents
            if (additional_dependents) {
              let dependentsArray = [];
              try {
                dependentsArray = JSON.parse(additional_dependents);
              } catch (parseError) {
                logger?.error(`Registration: JSON parse error for dependents: ${parseError.message}`);
                db.run("ROLLBACK;");
                return res.status(400).json({ error: "Invalid dependents JSON format." });
              }

              if (dependentsArray.length > 0) {
                const dependentPromises = dependentsArray.map(
                  (dependent) =>
                    new Promise((resolve, reject) => {
                      db.run(
                        `INSERT INTO dependents (full_name, age, visit_id) VALUES (?, ?, ?)`,
                        [dependent.full_name, dependent.age, visitId],
                        function (err) {
                          if (err) reject(err);
                          else resolve();
                        }
                      );
                    })
                );

                Promise.all(dependentPromises)
                  .then(() => {
                    db.run("COMMIT;");
                    logger.info(`Registration: Successful for ${first_name} ${last_name} (ID: ${visitorId}) with ${dependentsArray.length} dependents.`);
                    res.status(201).json({ message: "Visitor registered successfully!", id: visitorId });
                  })
                  .catch((promiseErr) => {
                    logger?.error(`Registration: Dependent insertion failed: ${promiseErr.message}`);
                    db.run("ROLLBACK;");
                    res.status(500).json({ error: "Failed to save dependents.", detail: promiseErr.message });
                  });
              } else {
                db.run("COMMIT;");
                logger?.info(`Registration: Successful for ${first_name} ${last_name} (ID: ${visitorId})`);
                res.status(201).json({ message: "Visitor registered successfully!", id: visitorId });
              }
            } else {
              db.run("COMMIT;");
              logger?.info(`Registration: Successful for ${first_name} ${last_name} (ID: ${visitorId})`);
              res.status(201).json({ message: "Visitor registered successfully!", id: visitorId });
            }
          }
        );
      });
    });
  });

  // Multer error handling
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      logger?.error(`Registration: Multer error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    } else if (err) {
      logger?.error(`Registration: Custom error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
    next();
  });

  return router;
}

module.exports = createRegistrationRouter;