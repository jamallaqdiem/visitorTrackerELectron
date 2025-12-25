const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createUpdateVisitorRouter = require("./update_visitor_details");

// Mock the database for testing
const mockDb = new sqlite3.Database(':memory:');
mockDb.serialize(() => {
  mockDb.run(`CREATE TABLE visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    photo_path TEXT,
    is_banned BOOLEAN
  )`);
  mockDb.run(`CREATE TABLE visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id INTEGER,
    entry_time TEXT,
    exit_time TEXT,
    known_as TEXT,
    address TEXT,
    phone_number TEXT,
    unit TEXT,
    reason_for_visit TEXT,
    type TEXT,
    company_name TEXT,
    mandatory_acknowledgment_taken TEXT
  )`);
  mockDb.run(`CREATE TABLE dependents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    age INTEGER,
    visit_id INTEGER
  )`);
});

// Create a mock Express app to test the router
const app = express();
app.use(express.json());
app.use("/", createUpdateVisitorRouter(mockDb));

// Clean up the test database after each test
afterEach(async () => {
  await new Promise((resolve, reject) => {
    mockDb.run(`DELETE FROM dependents`, (err) => {
      if (err) return reject(err);
      mockDb.run(`DELETE FROM visits`, (err) => {
        if (err) return reject(err);
        mockDb.run(`DELETE FROM visitors`, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
});

// Close the database connection after all tests
afterAll((done) => {
  mockDb.close((err) => {
    if (err) console.error(err.message);
    done();
  });
});

describe('POST /update-visitor-details', () => {
  test('should successfully update visitor details and return 201', async () => {
    // Insert a sample visitor
    const visitorId = await new Promise((resolve, reject) => {
      mockDb.run(`INSERT INTO visitors (first_name, last_name, is_banned) VALUES ('Jamal', 'Laqdiem', 0)`, function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });

    const updateData = {
      id: visitorId,
      phone_number: "07777210",
      unit: "202",
      reason_for_visit: "Meeting",
      type: "Visitor",
      additional_dependents: JSON.stringify([{ full_name: "Child 1", age: 5 }]),
    };

    const response = await request(app)
      .post('/update-visitor-details')
      .send(updateData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'Visitor Updated and Signed in Successfully!');
    expect(response.body).toHaveProperty('id');
  });

  test('should return 404 for a non-existent visitor ID', async () => {
    const updateData = {
      id: 999, // Non-existent ID
      phone_number: "07777210",
      unit: "202",
      reason_for_visit: "Meeting",
      type: "Visitor",
    };

    const response = await request(app)
      .post('/update-visitor-details')
      .send(updateData);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Visitor ID not found.');
  });
});
