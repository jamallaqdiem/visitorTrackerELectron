const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createVisitorsRouter = require("./visitors");

let mockDb;
let app;
let loggerMock;

const runDb = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        mockDb.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
};

beforeAll(async () => {
    mockDb = new sqlite3.Database(":memory:");
    loggerMock = { info: jest.fn(), error: jest.fn() };

    await runDb(`CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, photo_path TEXT, is_banned INTEGER DEFAULT 0)`);
    await runDb(`CREATE TABLE visits (id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT, exit_time TEXT, known_as TEXT, address TEXT, phone_number TEXT, unit TEXT, reason_for_visit TEXT, company_name TEXT, type TEXT, mandatory_acknowledgment_taken TEXT)`);
    await runDb(`CREATE TABLE dependents (id INTEGER PRIMARY KEY, visit_id INTEGER, full_name TEXT, age INTEGER)`);

    app = express();
    app.use(express.json()); 
    app.use("/", createVisitorsRouter(mockDb, loggerMock));
});

afterEach(async () => {
    await runDb("DELETE FROM dependents");
    await runDb("DELETE FROM visits");
    await runDb("DELETE FROM visitors");
    jest.clearAllMocks();
});

describe("GET /visitors", () => {
    test("should return only currently signed-in visitors", async () => {
        const result = await runDb(`INSERT INTO visitors (id, first_name, last_name) VALUES (1, 'Jane', 'Doe')`);
        await runDb(`INSERT INTO visits (visitor_id, entry_time, exit_time) VALUES (1, ?, NULL)`, [new Date().toISOString()]);

        const response = await request(app).get("/visitors");

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].first_name).toBe("Jane");
        expect(loggerMock.info).toHaveBeenCalled();
    });

    test("should return visitors sorted by entry_time descending", async () => {
        await runDb(`INSERT INTO visitors (id, first_name, last_name) VALUES (1, 'Early', 'Bird'), (2, 'Late', 'Comer')`);
        await runDb(`INSERT INTO visits (visitor_id, entry_time) VALUES (1, '2025-01-01T10:00:00Z')`);
        await runDb(`INSERT INTO visits (visitor_id, entry_time) VALUES (2, '2025-01-01T11:00:00Z')`);

        const response = await request(app).get("/visitors");

        expect(response.body[0].first_name).toBe("Late");
        expect(response.body[1].first_name).toBe("Early");
    });
});