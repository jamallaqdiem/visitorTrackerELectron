const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3');
const createBanRouter = require('./ban');

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};

const mockDb = new sqlite3.Database(':memory:');
const app = express();
app.use(express.json());

beforeAll((done) => {
    mockDb.run(`CREATE TABLE visitors (id INTEGER PRIMARY KEY, first_name TEXT, is_banned INTEGER DEFAULT 0)`, () => {
        mockDb.run(`INSERT INTO visitors (id, first_name, is_banned) VALUES (1, 'Test User', 0)`, done);
    });
});

// Pass the mockLogger here
app.use('/', createBanRouter(mockDb, mockLogger));

describe('POST /ban-visitor', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should ban a visitor and log the action', async () => {
        const response = await request(app)
            .post('/ban-visitor')
            .send({ visitor_id: 1 });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain("successfully");
        
        // Verify Winston log
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Visitor ID 1 has been successfully banned')
        );
    });

    test('should return 400 if visitor_id is missing', async () => {
        const response = await request(app).post('/ban-visitor').send({});
        expect(response.status).toBe(400);
        expect(mockLogger.warn).toHaveBeenCalled();
    });
});