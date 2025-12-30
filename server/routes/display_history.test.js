const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createHistoryRouter = require("./display_history");

// Mock Logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

const mockDb = new sqlite3.Database(':memory:');

// Helper to ensure DB operations are finished
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    mockDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    req.protocol = 'http';
    req.get = (header) => (header === 'host' ? 'test:3001' : null);
    next();
});

app.use("/", createHistoryRouter(mockDb, mockLogger));

beforeAll(async () => {
    // 1. Create tables and wait for completion
    await runAsync(`CREATE TABLE visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        photo_path TEXT,
        is_banned INTEGER DEFAULT 0
    )`);
    await runAsync(`CREATE TABLE visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id INTEGER,
        known_as TEXT,
        entry_time TEXT NOT NULL,
        exit_time TEXT,
        address TEXT,
        phone_number TEXT,
        unit TEXT,
        reason_for_visit TEXT,
        company_name TEXT,
        type TEXT,
        mandatory_acknowledgment_taken INTEGER DEFAULT 0,
        FOREIGN KEY (visitor_id) REFERENCES visitors(id)
    )`);
    await runAsync(`CREATE TABLE dependents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        age INTEGER,
        visit_id INTEGER,
        FOREIGN KEY (visit_id) REFERENCES visits(id)
    )`);
});

beforeEach(async () => {
    // 2. Clean tables
    await runAsync("DELETE FROM dependents");
    await runAsync("DELETE FROM visits");
    await runAsync("DELETE FROM visitors");

    // 3. Insert Test Data and wait
    await runAsync(`INSERT INTO visitors (id, first_name, last_name, is_banned) VALUES (1, 'Alice', 'Smith', 0)`);
    await runAsync(`INSERT INTO visits (id, visitor_id, entry_time, type, unit) 
                    VALUES (100, 1, '2024-05-01T10:00:00Z', 'Personal', 'A101')`);
    await runAsync(`INSERT INTO dependents (full_name, age, visit_id) VALUES ('Kid A', 5, 100)`);
    
    jest.clearAllMocks();
});

describe('History Router Integration Tests', () => {

    test('POST /authorize-history should log success/failure', async () => {
        process.env.MASTER_PASSWORD2 = 'secure123';
        
        await request(app).post('/authorize-history').send({ password: 'secure123' }).expect(200);
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Successful login"));

        await request(app).post('/authorize-history').send({ password: 'wrong' }).expect(403);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Failed login attempt"));
    });

    test('GET /history should retrieve records and log the query', async () => {
        const response = await request(app).get('/history');
        
        expect(response.status).toBe(200);
        // This will now be 1 because we properly awaited the insertion
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0].first_name).toBe('Alice');
        expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("History Query: Returned"));
    });
});