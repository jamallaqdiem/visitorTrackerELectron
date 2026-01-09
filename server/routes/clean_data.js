const { updateStatus } = require("../status_tracker");

/**
 * Executes the data retention compliance cleanup job.
 * Deletes records older than 2 years from dependents, visits, and finally visitors.
 *
 * @param {import('sqlite3').Database} db The SQLite database instance.
 * @param {object} logger Winston logger instance passed from server.js
 */
async function runDataComplianceCleanup(db, logger) {
    // Custom dbRun helper
    const dbRun = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({ changes: this.changes || 0 }); 
            });
        });
    };

    logger?.info('--- Starting Data Retention Compliance Cleanup Job ---');

    let deletedCounts = { dependents: 0, visits: 0, profiles: 0 };
    // Exact 2 years calculation
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    let auditStatus = 'OK';
    let auditEvent = 'Compliance Cleanup Succeeded';

    try {
        // 1. Delete Dependents
        const deleteDependentsSql = `
            DELETE FROM dependents
            WHERE visit_id IN (SELECT id FROM visits WHERE entry_time < ?);
        `;
        const depRes = await dbRun(deleteDependentsSql, [twoYearsAgo]);
        deletedCounts.dependents = depRes.changes;

        // 2. Delete Visits
        const deleteVisitsSql = `DELETE FROM visits WHERE entry_time < ?`;
        const visitRes = await dbRun(deleteVisitsSql, [twoYearsAgo]);
        deletedCounts.visits = visitRes.changes;

        // 3. Delete Inactive Visitors (Not banned, no visits left)
        const deleteVisitorsSql = `
            DELETE FROM visitors
            WHERE id NOT IN (SELECT visitor_id FROM visits)
            AND is_banned = 0;
        `;
        const visitorRes = await dbRun(deleteVisitorsSql);
        deletedCounts.profiles = visitorRes.changes;

        logger.info(`Cleanup Results: Profiles[${deletedCounts.profiles}] Visits[${deletedCounts.visits}] Dependents[${deletedCounts.dependents}]`);
        
        // Update the Global Status Tracker for the Health Widget
        updateStatus("last_cleanup", new Date().toISOString());

    } catch (error) {
        auditStatus = 'ERROR';
        auditEvent = 'Compliance Cleanup Failed';
        logger?.error(`Compliance Cleanup Error: ${error.message}`);
        updateStatus("last_error", `Cleanup Failed: ${error.message}`);
    } finally {
        // 4. Writing Audit Log to Database
        const auditLogSql = `
            INSERT INTO audit_logs (event_name, timestamp, status, profiles_deleted, visits_deleted, dependents_deleted)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const auditParams = [
            auditEvent,
            new Date().toISOString(),
            auditStatus,
            deletedCounts.profiles,
            deletedCounts.visits,
            deletedCounts.dependents
        ];

        try {
            await dbRun(auditLogSql, auditParams);
            logger?.info(`Compliance Audit Log saved: ${auditStatus}`);
        } catch (auditError) {
            logger?.error(`CRITICAL: Cleanup job could not write to audit_logs: ${auditError.message}`);
        }
    }
}

module.exports = runDataComplianceCleanup;