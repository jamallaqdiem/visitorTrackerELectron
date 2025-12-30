const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createMissedVisitRouter = require("./record_missed_visit");

let mockDb;
let app;
let loggerMock;

beforeAll((done) => {
    mockDb = new sqlite3.Database(':memory:');
    loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    
    mockDb.serialize(() => {
        mockDb.run("CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT)");
        mockDb.run(`CREATE TABLE visits (
            id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT, exit_time TEXT, 
            known_as TEXT, address TEXT, phone_number TEXT, unit TEXT, 
            reason_for_visit TEXT, type TEXT, company_name TEXT, mandatory_acknowledgment_taken TEXT
        )`, done);
    });

    app = express();
    app.use(express.json());
    app.use("/", createMissedVisitRouter(mockDb, loggerMock));
});

afterEach((done) => {
    mockDb.run("DELETE FROM visits", () => {
        mockDb.run("DELETE FROM visitors", done);
    });
});

describe('POST /record-missed-visit', () => {
    test('should successfully record a missed visit', async () => {
        // Setup: Create a visitor
        await new Promise(resolve => mockDb.run("INSERT INTO visitors (id, first_name) VALUES (1, 'Test')", resolve));
        
        const pastTime = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
        
        const response = await request(app)
            .post('/record-missed-visit')
            .send({ visitorId: 1, pastEntryTime: pastTime });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain("Visitor Entry Time Corrected");
        expect(loggerMock.info).toHaveBeenCalled();
    });

    test('should return 400 for future entry time', async () => {
        const futureTime = new Date(Date.now() + 3600000).toISOString();
        const response = await request(app)
            .post('/record-missed-visit')
            .send({ visitorId: 1, pastEntryTime: futureTime });

        expect(response.status).toBe(400);
        expect(loggerMock.warn).toHaveBeenCalled();
    });
});