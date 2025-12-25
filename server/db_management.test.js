const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { checkDatabaseIntegrity, restoreFromBackup, createBackup } = require('./db_management');

const TEMP_DATA_DIR = path.join(__dirname, 'temp_test_data');
const TEST_DB_PATH = path.join(TEMP_DATA_DIR, 'test_database.db');

describe('Database Management Suite', () => {
    // 1. Setup before all tests
    beforeAll(() => {
        if (!fs.existsSync(TEMP_DATA_DIR)) {
            fs.mkdirSync(TEMP_DATA_DIR, { recursive: true });
        }
    });

    // 2. Cleanup after all tests
    afterAll(async () => {
        // Small delay to allow console logs to flush
        await new Promise(resolve => setTimeout(resolve, 500));
        if (fs.existsSync(TEMP_DATA_DIR)) {
            fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
        }
    });

    test('checkDatabaseIntegrity returns false for missing file', async () => {
        const result = await checkDatabaseIntegrity(path.join(TEMP_DATA_DIR, 'non_existent.db'));
        expect(result).toBe(false);
    });

    test('checkDatabaseIntegrity returns true for healthy database', async () => {
        const db = new sqlite3.Database(TEST_DB_PATH);
        await new Promise((resolve, reject) => {
            db.run('CREATE TABLE test (id INTEGER)', (err) => err ? reject(err) : resolve());
        });
        
        // Wait for the DB to close completely
        await new Promise(resolve => db.close(resolve));

        const result = await checkDatabaseIntegrity(TEST_DB_PATH);
        expect(result).toBe(true);
    });

    test('createBackup successfully creates a backup file', () => {
        const success = createBackup(TEST_DB_PATH, TEMP_DATA_DIR);
        expect(success).toBe(true);

        const backupDir = path.join(TEMP_DATA_DIR, 'backups');
        const files = fs.readdirSync(backupDir);
        expect(files.length).toBeGreaterThan(0);
        expect(files[0]).toMatch(/test_database-.*\.db/);
    });

    test('restoreFromBackup recovers database from latest backup', () => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        expect(fs.existsSync(TEST_DB_PATH)).toBe(false);

        const success = restoreFromBackup(TEMP_DATA_DIR, 'test_database.db');
        expect(success).toBe(true);
        expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
    });
});