const express = require("express");
const path = require("path");
const multer = require("multer");

/**
 * Creates and configures a router for handling new visitor registrations.
 *
 * @param {object} db - The SQLite database instance.
 * @returns {express.Router} - An Express router with the registration endpoint.
 */
function createRegistrationRouter(db, upload) {
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
    const photo_path = req.file
      ? `/uploads/${req.file.filename}` //  unique filename from multer, prefixed with the URL segment '/uploads'
  : null;
    // SQL to check if a visitor with the same full name exists
    const checkSql = `SELECT id FROM visitors WHERE first_name = ? AND last_name = ?`;

    db.get(checkSql, [first_name, last_name], (err, row) => {
      if (err) {
        console.error("SQL Error during duplicate check:", err.message);
        return res.status(500).json({ error: err.message });
      }

      // If a row is found, it means the visitor already exists.
      if (row) {
        const message = `A visitor named ${first_name} ${last_name} already exists . Please use the search bar to log them in.`;
        return res.status(409).json({ message }); 
      }

        db.run("BEGIN TRANSACTION;");

        const visitorSql = `INSERT INTO visitors (first_name, last_name, photo_path) VALUES (?, ?, ?)`;
        db.run(visitorSql, [first_name, last_name, photo_path], function (err) {
          if (err) {
            db.run("ROLLBACK;");
            return res.status(500).json({ error: err.message });
          }
          const visitorId = this.lastID;

          const visitsSql = `
          INSERT INTO visits (
            visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name ,mandatory_acknowledgment_taken
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
          const entry_time = new Date().toISOString();
          db.run(
            visitsSql,
            [
              visitorId,
              entry_time,
              known_as,
              address,
              phone_number,
              unit,
              reason_for_visit,
              type,
              company_name,
              mandatory_acknowledgment_taken,
            ],
            function (err) {
              if (err) {
                db.run("ROLLBACK;");
                return res.status(500).json({ error: err.message });
              }
              const visitId = this.lastID;

              if (additional_dependents) {
                let dependentsArray = [];
                try {
                  dependentsArray = JSON.parse(additional_dependents);
                } catch (parseError) {
                  db.run("ROLLBACK;");
                  return res
                    .status(400)
                    .json({ error: "Invalid dependents JSON format." });
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
                      res.status(201).json({
                        message: "Visitor registered successfully!",
                        id: visitorId,
                      });
                    })
                    .catch((promiseErr) => {
                      db.run("ROLLBACK;");
                      res.status(500).json({
                        error: "Failed to save dependents.",
                        detail: promiseErr.message,
                      });
                    });
                } else {
                  db.run("COMMIT;");
                  res.status(201).json({
                    message: "Visitor registered successfully!",
                    id: visitorId,
                  });
                }
              } else {
                db.run("COMMIT;");
                res.status(201).json({
                  message: "Visitor registered successfully!",
                  id: visitorId,
                });
              }
            }
          );
        });
    });
  });

  // Centralized error handler for the router. Catches errors from multer.
  router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred (e.g., file too large).
      return res.status(400).json({ error: err.message });
    } else if (err) {
      // A custom error occurred
      return res.status(400).json({ error: err.message });
    }
    next();
  });

  return router;
}

module.exports = createRegistrationRouter;
