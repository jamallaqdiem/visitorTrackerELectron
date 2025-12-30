const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createAuditRouter = require("./audit_logs");
const { getStatus, updateStatus } = require("../status_tracker");

let mockDb;
let app;
let loggerMock;

const runDb = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
};

beforeAll(async () => {
    mockDb = new sqlite3.Database(":memory:");
    loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };

    // event_name, timestamp, and status are NOT NULL
    await runDb(mockDb, `
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY,
            event_name TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            profiles_deleted INTEGER,
            visits_deleted INTEGER,
            dependents_deleted INTEGER
        )
    `);

    app = express();
    app.use(express.json());
    app.use("/api/audit", createAuditRouter(mockDb, loggerMock));
});

afterEach(async () => {
    await runDb(mockDb, "DELETE FROM audit_logs");
    updateStatus("last_error", null);
    jest.clearAllMocks();
});

describe("Audit Log Endpoint Integration Test", () => {
    
  test("POST /api/audit/log-error should return 201 on success", async () => {
        const testData = {
            event_name: "UI_CRASH",
            timestamp: new Date().toISOString(),
            status: "ERROR"
        };

        const response = await request(app)
            .post('/api/audit/log-error')
            .send(testData)
            .expect(201);
        expect(response.body.message).toBe("Client error logged successfully");
    });

    test("POST /api/audit/log-error should return 400 if fields are missing", async () => {
        const response = await request(app)
            .post('/api/audit/log-error')
            .send({ event_name: "ONLY_NAME" }) // Missing timestamp/status
            .expect(400);

        expect(loggerMock.warn).toHaveBeenCalled();
    });

test("POST /api/audit/log-error should return 400 if fields are totally missing", async () => {
        const response = await request(app)
            .post('/api/audit/log-error')
            .send({ message: "no name or status" }) 
            .expect(400);
    });

    test("POST /api/audit/log-error should return 202 if DB insertion fails (Constraint Violation)", async () => {
        const testData = {
            event_name: "DB_FAIL_TRIGGER",
            timestamp: null, // This violates the NOT NULL constraint in SQLite
            status: "ERROR"
        };

        const response = await request(app)
            .post('/api/audit/log-error')
            .send(testData);

        expect(response.status).toBe(202); 
        expect(response.body.message).toContain("backend insertion failed");
    });
});