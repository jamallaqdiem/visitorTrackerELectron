const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createUpdateRouter = require("./update_visitor_details");

let mockDb;
let app;
let loggerMock;

beforeAll((done) => {
  mockDb = new sqlite3.Database(':memory:');
  loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  mockDb.serialize(() => {
    mockDb.run(`CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, is_banned BOOLEAN)`);
    mockDb.run(`CREATE TABLE visits (id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT, known_as TEXT, address TEXT, phone_number TEXT, unit TEXT, reason_for_visit TEXT, type TEXT, company_name TEXT, mandatory_acknowledgment_taken TEXT)`);
    mockDb.run(`CREATE TABLE dependents (id INTEGER PRIMARY KEY, full_name TEXT, age INTEGER, visit_id INTEGER)`, done);
  });

  app = express();
  app.use(express.json());
  app.use("/", createUpdateRouter(mockDb, loggerMock));
});

afterEach((done) => {
  mockDb.serialize(() => {
    mockDb.run("DELETE FROM dependents");
    mockDb.run("DELETE FROM visits");
    mockDb.run("DELETE FROM visitors", done);
  });
});

describe('POST /update-visitor-details', () => {
  test('should successfully update visitor and return 201', async () => {
    await new Promise(res => mockDb.run("INSERT INTO visitors (id, first_name) VALUES (1, 'Jamal')", res));

    const response = await request(app)
      .post('/update-visitor-details')
      .send({ id: 1, unit: "202", additional_dependents: JSON.stringify([{ full_name: "Kid", age: 5 }]) });

    expect(response.status).toBe(201);
    expect(response.body.message).toContain("Successfully");
    expect(loggerMock.info).toHaveBeenCalled();
  });

  test('should return 404 for missing visitor', async () => {
    const response = await request(app).post('/update-visitor-details').send({ id: 999 });
    expect(response.status).toBe(404);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});