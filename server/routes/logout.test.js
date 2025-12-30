const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createLogoutRouter = require("./logout");

let mockDb;
let app;
let loggerMock;

beforeAll((done) => {
  mockDb = new sqlite3.Database(":memory:");
  loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  
  mockDb.serialize(() => {
    mockDb.run("CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT)");
    mockDb.run("CREATE TABLE visits (id INTEGER PRIMARY KEY, visitor_id INTEGER, entry_time TEXT, exit_time TEXT)", done);
  });

  app = express();
  app.use(express.json());
  app.use("/", createLogoutRouter(mockDb, loggerMock));
});

afterEach((done) => {
  mockDb.run("DELETE FROM visits", () => {
    mockDb.run("DELETE FROM visitors", () => {
      jest.clearAllMocks();
      done();
    });
  });
});

afterAll((done) => {
  mockDb.close(done);
});

describe("POST /exit-visitor/:id", () => {
  test("should successfully log out a visitor", async () => {
    // Setup visitor and open visit
    await new Promise(resolve => {
      mockDb.run("INSERT INTO visitors (id, first_name, last_name) VALUES (1, 'Jamal', 'Laqdiem')", () => {
        mockDb.run("INSERT INTO visits (visitor_id, entry_time) VALUES (1, '2025-01-01')", resolve);
      });
    });

    const response = await request(app).post("/exit-visitor/1");

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Jamal Laqdiem");
    expect(loggerMock.info).toHaveBeenCalled();
  });

  test("should return 404 for non-existent visit", async () => {
    const response = await request(app).post("/exit-visitor/999");
    expect(response.status).toBe(404);
    expect(loggerMock.warn).toHaveBeenCalled();
  });
});