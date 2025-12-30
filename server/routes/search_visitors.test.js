const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createSearchRouter = require("./search_visitors");

let mockDb;
let app;
let loggerMock;

beforeAll((done) => {
  mockDb = new sqlite3.Database(':memory:');
  loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  mockDb.serialize(() => {
    // 1. Visitors Table
    mockDb.run(`CREATE TABLE visitors (
      id INTEGER PRIMARY KEY, 
      first_name TEXT, 
      last_name TEXT, 
      photo_path TEXT, 
      is_banned BOOLEAN
    )`);

    // 2. Visits Table 
    mockDb.run(`CREATE TABLE visits (
      id INTEGER PRIMARY KEY, 
      visitor_id INTEGER, 
      entry_time TEXT, 
      known_as TEXT, 
      address TEXT, 
      phone_number TEXT, 
      unit TEXT, 
      reason_for_visit TEXT, 
      type TEXT, 
      company_name TEXT, 
      mandatory_acknowledgment_taken TEXT
    )`);

    // 3. Dependents Table
    mockDb.run(`CREATE TABLE dependents (
      id INTEGER PRIMARY KEY, 
      full_name TEXT, 
      age INTEGER, 
      visit_id INTEGER
    )`, done);
  });

  app = express();
  app.use(express.json());
  app.use("/", createSearchRouter(mockDb, loggerMock));
});

afterEach((done) => {
  mockDb.run("DELETE FROM dependents", () => {
    mockDb.run("DELETE FROM visits", () => {
      mockDb.run("DELETE FROM visitors", done);
    });
  });
});

describe('GET /visitor-search', () => {
  test('should return visitor when valid name is provided', async () => {
    await new Promise(resolve => {
      mockDb.run("INSERT INTO visitors (id, first_name, last_name) VALUES (1, 'John', 'Doe')", () => {
        mockDb.run("INSERT INTO visits (visitor_id, entry_time) VALUES (1, '2025-01-01')", resolve);
      });
    });

    const response = await request(app).get('/visitor-search?name=John');

    expect(response.status).toBe(200);
    expect(response.body[0].first_name).toBe('John');
    expect(loggerMock.info).toHaveBeenCalled();
  });

  test('should return 400 if name query is missing', async () => {
    const response = await request(app).get('/visitor-search');
    expect(response.status).toBe(400);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});