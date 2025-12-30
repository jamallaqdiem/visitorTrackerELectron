const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createUnbanRouter = require("./unban");

let mockDb;
let app;
let loggerMock;

// Set env variable for testing
process.env.MASTER_PASSWORD = "test_password";

beforeAll((done) => {
  mockDb = new sqlite3.Database(':memory:');
  loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

  mockDb.serialize(() => {
    mockDb.run(`CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, is_banned INTEGER DEFAULT 0)`, done);
  });

  app = express();
  app.use(express.json());
  app.use("/", createUnbanRouter(mockDb, loggerMock));
});

afterEach((done) => {
  mockDb.run("DELETE FROM visitors", () => {
    jest.clearAllMocks();
    done();
  });
});

afterAll((done) => {
  mockDb.close(done);
});

describe('POST /unban-visitor/:id', () => {
  test('should successfully unban with correct password', async () => {
    // Setup: Insert banned visitor
    await new Promise(resolve => mockDb.run("INSERT INTO visitors (id, is_banned) VALUES (1, 1)", resolve));

    const response = await request(app)
      .post('/unban-visitor/1')
      .send({ password: "test_password" });

    expect(response.status).toBe(200);
    expect(loggerMock.info).toHaveBeenCalled();

    // Verify DB
    const row = await new Promise(res => mockDb.get("SELECT is_banned FROM visitors WHERE id = 1", (err, r) => res(r)));
    expect(row.is_banned).toBe(0);
  });

  test('should return 403 for incorrect password', async () => {
    const response = await request(app)
      .post('/unban-visitor/1')
      .send({ password: "wrong" });

    expect(response.status).toBe(403);
    expect(loggerMock.warn).toHaveBeenCalled();
  });

  test('should return 404 if ID does not exist', async () => {
    const response = await request(app)
      .post('/unban-visitor/999')
      .send({ password: "test_password" });

    expect(response.status).toBe(404);
  });
});