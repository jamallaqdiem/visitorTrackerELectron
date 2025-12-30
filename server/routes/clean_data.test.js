const sqlite3 = require('sqlite3').verbose();
const runDataComplianceCleanup = require('./clean_data');
const { getStatus, updateStatus } = require('../status_tracker');

// 1. Mock the Logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('Data Compliance Cleanup Job', () => {
    let db;

    beforeEach((done) => {
        db = new sqlite3.Database(':memory:');
        // Setup schema
        db.serialize(() => {
            db.run(`CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, is_banned INTEGER DEFAULT 0)`);
            db.run(`CREATE TABLE visits (id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT)`);
            db.run(`CREATE TABLE dependents (id INTEGER PRIMARY KEY, visit_id INTEGER, full_name TEXT)`);
            db.run(`CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, event_name TEXT, timestamp TEXT, status TEXT, profiles_deleted INTEGER, visits_deleted INTEGER, dependents_deleted INTEGER)`, done);
        });
        // Reset status before each test
        updateStatus("last_cleanup", "N/A");
    });

    afterEach((done) => {
        db.close(done);
    });

    test('should delete records older than 2 years and update status_tracker', async () => {
        const now = new Date();
        const threeYearsAgo = new Date(now.setFullYear(now.getFullYear() - 3)).toISOString();
        const justNow = new Date().toISOString();

        // Seed Data
        await new Promise((resolve) => {
            db.serialize(() => {
                // Old data (should be deleted)
                db.run(`INSERT INTO visitors (id, first_name) VALUES (1, 'Old User')`);
                db.run(`INSERT INTO visits (id, visitor_id, entry_time) VALUES (10, 1, ?)`, [threeYearsAgo]);
                db.run(`INSERT INTO dependents (visit_id, full_name) VALUES (10, 'Old Child')`);

                // New data (should stay)
                db.run(`INSERT INTO visitors (id, first_name) VALUES (2, 'New User')`);
                db.run(`INSERT INTO visits (id, visitor_id, entry_time) VALUES (20, 2, ?)`, [justNow]);
                resolve();
            });
        });

        // Run Cleanup
        await runDataComplianceCleanup(db, mockLogger);

        // Verify Deletions
        await new Promise((resolve) => {
            db.all("SELECT * FROM visits", (err, rows) => {
                expect(rows.length).toBe(1); // Only the new visit remains
                expect(rows[0].id).toBe(20);
                resolve();
            });
        });

        await new Promise((resolve) => {
            db.all("SELECT * FROM visitors", (err, rows) => {
                expect(rows.length).toBe(1); // Old user profile with no visits was deleted
                expect(rows[0].id).toBe(2);
                resolve();
            });
        });

        // Verify Status Tracker
        expect(getStatus().last_cleanup).not.toBe("N/A");
        
        // Verify Logger was used
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Starting Data Retention'));
    });

    test('should NOT delete banned visitors even if they have no visits', async () => {
        await new Promise((resolve) => {
            // Banned user with no visits
            db.run(`INSERT INTO visitors (id, first_name, is_banned) VALUES (99, 'Banned User', 1)`, resolve);
        });

        await runDataComplianceCleanup(db, mockLogger);

        await new Promise((resolve) => {
            db.get("SELECT * FROM visitors WHERE id = 99", (err, row) => {
                expect(row).toBeDefined(); // Should still be there
                resolve();
            });
        });
    });
});