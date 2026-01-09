const request = require("supertest");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const createUnbanRouter = require("./unban");

let mockDb;
let app;
let loggerMock;

// The password defined here will be passed into the router
const TEST_ADMIN_PASSWORD = "test_password_123";

beforeAll((done) => {
    // Initialize in-memory database for fast testing
    mockDb = new sqlite3.Database(':memory:');
    
    // Create a mock logger with all required methods
    loggerMock = { 
        info: jest.fn(), 
        warn: jest.fn(), 
        error: jest.fn() 
    };

    mockDb.serialize(() => {
        mockDb.run(
            `CREATE TABLE visitors (
                id INTEGER PRIMARY KEY, 
                first_name TEXT, 
                is_banned INTEGER DEFAULT 0
            )`, 
            done
        );
    });

    app = express();
    app.use(express.json());
    
    app.use("/", createUnbanRouter(mockDb, loggerMock, TEST_ADMIN_PASSWORD));
});

afterEach((done) => {
    // Clean up the database between tests
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
        // Setup: Insert a banned visitor
        await new Promise(resolve => 
            mockDb.run("INSERT INTO visitors (id, first_name, is_banned) VALUES (1, 'John', 1)", resolve)
        );

        const response = await request(app)
            .post('/unban-visitor/1')
            .send({ password: TEST_ADMIN_PASSWORD });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain("successfully");
        expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining("unbanned"));

        // Verify changes in DB
        const row = await new Promise(res => 
            mockDb.get("SELECT is_banned FROM visitors WHERE id = 1", (err, r) => res(r))
        );
        expect(row.is_banned).toBe(0);
    });

    test('should return 403 for incorrect password', async () => {
        const response = await request(app)
            .post('/unban-visitor/1')
            .send({ password: "wrong_password" });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Incorrect password.");
        expect(loggerMock.warn).toHaveBeenCalled();
    });

    test('should return 404 if ID does not exist', async () => {
        const response = await request(app)
            .post('/unban-visitor/999')
            .send({ password: TEST_ADMIN_PASSWORD });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Visitor not found.");
        expect(loggerMock.warn).toHaveBeenCalled();
    });

    test('should return 403 if password is missing from request body', async () => {
        const response = await request(app)
            .post('/unban-visitor/1')
            .send({}); // Sending empty body

        expect(response.status).toBe(403);
    });
});