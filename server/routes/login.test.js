const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createLoginRouter = require("./login");

let mockDb;
let app;
let loggerMock;

const runDb = (db, sql, params = []) => new Promise((res, rej) => {
    db.run(sql, params, function(err) { if (err) rej(err); else res(this); });
});

beforeAll(async () => {
    mockDb = new sqlite3.Database(':memory:');
    loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    // Added the missing columns that the router's SELECT query needs
    await runDb(mockDb, `CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, is_banned INTEGER DEFAULT 0)`);
    await runDb(mockDb, `CREATE TABLE visits (
        id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT, 
        known_as TEXT, address TEXT, phone_number TEXT, unit TEXT, 
        reason_for_visit TEXT, type TEXT, company_name TEXT, 
        mandatory_acknowledgment_taken TEXT
    )`);
    await runDb(mockDb, `CREATE TABLE dependents (id INTEGER PRIMARY KEY, visit_id INTEGER, full_name TEXT, age INTEGER)`);

    app = express();
    app.use(express.json());
    app.use("/", createLoginRouter(mockDb, loggerMock));
});

afterEach(async () => {
    await runDb(mockDb, `DELETE FROM dependents`);
    await runDb(mockDb, `DELETE FROM visits`);
    await runDb(mockDb, `DELETE FROM visitors`);
    jest.clearAllMocks();
});

describe('POST /login', () => {
  test('should return 200 on successful login', async () => {
    await runDb(mockDb, `INSERT INTO visitors (id, first_name) VALUES (1, 'John')`);
    const response = await request(app).post('/login').send({ id: 1 });
    expect(response.status).toBe(200);
  });

  test('should return 403 for banned visitors', async () => {
    await runDb(mockDb, `INSERT INTO visitors (id, is_banned) VALUES (2, 1)`);
    const response = await request(app).post('/login').send({ id: 2 });
    expect(response.status).toBe(403);
  });

  test('should return 404 for unknown visitors', async () => {
    const response = await request(app).post('/login').send({ id: 999 });
    expect(response.status).toBe(404);
  });
});