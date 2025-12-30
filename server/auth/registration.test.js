const request = require('supertest');
const express = require('express');
const sqlite3 = require('sqlite3');
const createRegistrationRouter = require('./registration');

// 1. Mock the Logger (Critical for the new router signature)
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockDb = new sqlite3.Database(':memory:');

const mockUpload = {
    single: () => (req, res, next) => next(),
    none: () => (req, res, next) => next(),
    array: () => (req, res, next) => next(),
    fields: () => (req, res, next) => next(),
};

// Ensure memory DB matches the production table structure
mockDb.serialize(() => {
    mockDb.run(`CREATE TABLE visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        photo_path TEXT,
        is_banned INTEGER DEFAULT 0 
    )`);
    mockDb.run(`CREATE TABLE visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id INTEGER,
        entry_time TEXT,
        known_as TEXT,
        address TEXT,
        phone_number TEXT,
        unit TEXT,
        reason_for_visit TEXT,
        type TEXT,
        company_name TEXT,
        mandatory_acknowledgment_taken INTEGER DEFAULT 0
    )`);
    mockDb.run(`CREATE TABLE dependents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT,
        age INTEGER,
        visit_id INTEGER
    )`);
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Pass the mockLogger as the 3rd argument
app.use('/', createRegistrationRouter(mockDb, mockUpload, mockLogger)); 

afterEach(() => {
    mockDb.run(`DELETE FROM visitors`);
    mockDb.run(`DELETE FROM visits`);
    mockDb.run(`DELETE FROM dependents`);
    jest.clearAllMocks(); // Clear logger call counts between tests
});

describe('POST /register-visitor', () => {
    test('should register a new visitor and log the success to Winston', async () => {
        const registrationData = {
            first_name: 'Jamal',
            last_name: 'Laqdiem',
            known_as: 'miky',
            address: '700 london road Portsmouth',
            phone_number: '022277',
            unit: '101',
            reason_for_visit: 'Meeting',
            type: 'Visitor',
            company_name: 'NHS',
            mandatory_acknowledgment_taken: 1
        };

        const response = await request(app)
            .post('/register-visitor')
            .send(registrationData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', "Visitor registered successfully!"); 
        
        // 3. Verify that the logger was actually called
        expect(mockLogger.info).toHaveBeenCalledWith(
            expect.stringContaining('Registration: Successful for Jamal Laqdiem')
        );
    });

    test('should return 409 and log a warning if visitor already exists', async () => {
        // Pre-insert a visitor
        await new Promise(resolve => mockDb.run(
            "INSERT INTO visitors (first_name, last_name) VALUES (?, ?)", 
            ['Jamal', 'Laqdiem'], resolve
        ));

        const registrationData = {
            first_name: 'Jamal',
            last_name: 'Laqdiem'
        };

        const response = await request(app)
            .post('/register-visitor')
            .send(registrationData);

        expect(response.status).toBe(409);
        expect(mockLogger.warn).toHaveBeenCalled();
    });
});