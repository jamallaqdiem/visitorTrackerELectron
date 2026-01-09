const express = require("express");

module.exports = (db, logger) => {
    const router = express.Router();

    router.post("/record-missed-visit", (req, res) => {
        const { visitorId, pastEntryTime } = req.body;
        
        if (!visitorId || !pastEntryTime) {
            logger?.warn("Missed Visit Attempt: Missing visitorId or pastEntryTime.");
            return res.status(400).json({ message: "Missing visitor ID or required entry time." });
        }

        const currentExitTime = new Date().toISOString();
        const entryDate = new Date(pastEntryTime);
        const exitDate = new Date(currentExitTime);

        if (isNaN(entryDate.getTime()) || entryDate >= exitDate) {
            logger?.warn(`Missed Visit Failed: Invalid entry time for ID ${visitorId}`);
            return res.status(400).json({ 
                message: "Invalid entry time. It must be a valid date/time and occur before the current exit time." 
            });
        }
        
        const entry_time_iso = entryDate.toISOString();

        // Step 1: Find the details of the visitor's most recent visit to inherit data
        const selectSql = `
            SELECT 
                known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
            FROM visits 
            WHERE visitor_id = ? 
            ORDER BY entry_time DESC 
            LIMIT 1
        `;

        db.get(selectSql, [visitorId], (err, lastVisit) => {
            if (err) {
                logger?.error(`Missed Visit SQL Error (Select): ${err.message}`);
                return res.status(500).json({ error: "Database error during lookup: " + err.message });
            }

            const visitDetails = lastVisit || {};
            const knownAs = visitDetails.known_as || '--';
            const address1 = visitDetails.address || '--';
            const phoneNumber = visitDetails.phone_number || null;
            const unit = visitDetails.unit || "--"; 
            const reasonForVisit = visitDetails.reason_for_visit || null;
            const type = visitDetails.type || "Visitor"; 
            const companyName = visitDetails.company_name || null;
            const mandatoryTaken = visitDetails.mandatory_acknowledgment_taken || '--'

            // Step 2: Insert the new historical record
            const insertSql = `
                INSERT INTO visits (
                    visitor_id, entry_time, exit_time, known_as, address, phone_number, unit, reason_for_visit, type, company_name, mandatory_acknowledgment_taken
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(insertSql, 
                [visitorId, entry_time_iso, currentExitTime, knownAs, address1, phoneNumber, unit, reasonForVisit, type, companyName, mandatoryTaken], 
                function (err) {
                    if (err) {
                        logger?.error(`Missed Visit SQL Error (Insert): ${err.message}`);
                        return res.status(500).json({ error: "Failed to record historical visit: " + err.message });
                    }

                    logger?.info(`Missed Visit Recorded: Visitor ID ${visitorId} corrected for ${entry_time_iso}`);
                    
                    res.status(200).json({
                        message: "Visitor Entry Time Corrected & Sing it Out",
                        entry: entry_time_iso,
                        exit: currentExitTime
                    });
                }
            );
        });
    });

    return router;
};