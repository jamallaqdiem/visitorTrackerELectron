const express = require("express");

/**
 * Creates and configures a router for handling visitor data updates for a returning visitor.
 *
 * @param {object} db - The SQLite database instance.
 * @returns {express.Router} - An Express router with the update endpoint.
 */
function createUpdateVisitorRouter(db) {
  const router = express.Router();

  // Endpoint to handle visitor data updates (new visit) for a returning visitor
  router.post("/update-visitor-details", (req, res) => {
    const {
      id,
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

    if (!id) {
      return res
        .status(400)
        .json({ message: "Visitor ID is required for re-registration." });
    }
    // Use a transaction
      db.run("BEGIN TRANSACTION;");

      // First, verify the visitor ID exists in the system
      db.get("SELECT id FROM visitors WHERE id = ?", [id], (err, visitorRow) => {
        if (err || !visitorRow) {
          db.run("ROLLBACK;");
          return res.status(404).json({ message: "Visitor ID not found." });
        }

        // Insert a new visit record.
        const visitsSql = `
          INSERT INTO visits (
            visitor_id, entry_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const entry_time = new Date().toISOString();

        db.run(
          visitsSql,
          [
            id, // Use the existing visitor ID
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
              console.error("SQL Error inserting new visit:", err.message);
              return res.status(500).json({ error: err.message });
            }
            const newVisitId = this.lastID;

            // handle dependents and link them to the NEW visit record
            if (additional_dependents) {
              let dependentsArray = [];
              try {
                dependentsArray = JSON.parse(additional_dependents);
              } catch (parseError) {
                console.error(
                  "Failed to parse dependents JSON. Treating as single dependent.",
                  parseError
                );
                // Fallback for non-JSON dependent string
                dependentsArray = [
                  { full_name: additional_dependents, age: null },
                ];
              }

              if (dependentsArray.length > 0) {
                const dependentPromises = dependentsArray.map(
                  (dependent) =>
                    new Promise((resolve, reject) => {
                      db.run(
                        `INSERT INTO dependents (full_name, age, visit_id) VALUES (?, ?, ?)`,
                        [dependent.full_name, dependent.age, newVisitId],
                        function (err) {
                          if (err) {
                            reject(err);
                          } else {
                            resolve();
                          }
                        }
                      );
                    })
                );

                Promise.all(dependentPromises)
                  .then(() => {
                    db.run("COMMIT;");
                    res.status(201).json({
                      message: "Visitor Updated and Signed in Successfully!",
                      id: newVisitId,
                    });
                  })
                  .catch((err) => {
                    console.error("Error inserting dependent:", err.message);
                    db.run("ROLLBACK;");
                    res.status(500).json({ error: "Transaction failed." });
                  });
              } else {
                db.run("COMMIT;");
                res.status(201).json({
                  message: "Visitor Updated Successfully & signed in!",
                  id: newVisitId,
                });
              }
            } else {
              db.run("COMMIT;");
              res.status(201).json({
                message: "Visitor Updated Successfully & signed in!",
                id: newVisitId,
              });
            }
          }
        );
      });
  });

  return router;
}

module.exports = createUpdateVisitorRouter;
