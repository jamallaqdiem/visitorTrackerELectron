const { updateStatus, getStatus } = require('./status_tracker');

describe('StatusTracker utility', () => {

    // Reset the status object before each test to ensure a clean state
    beforeEach(() => {
        updateStatus('db_ready', false);
        updateStatus('last_backup', 'N/A');
        updateStatus('last_cleanup', 'N/A');
        updateStatus('last_error', null);
    });

    test('should initialize with default values', () => {
        const status = getStatus();
        expect(status.db_ready).toBe(false);
        expect(status.last_backup).toBe('N/A');
        expect(status.last_error).toBeNull();
    });

    test('should update db_ready status to true', () => {
        updateStatus('db_ready', true);
        const status = getStatus();
        expect(status.db_ready).toBe(true);
    });

    test('should update last_backup with a timestamp', () => {
        const timestamp = new Date().toISOString();
        updateStatus('last_backup', timestamp);
        const status = getStatus();
        expect(status.last_backup).toBe(timestamp);
    });

    test('should log a severe error message', () => {
        const errorMsg = "Database Connection Lost";
        updateStatus('last_error', errorMsg);
        const status = getStatus();
        expect(status.last_error).toBe(errorMsg);
    });

    test('should keep other values unchanged when one is updated', () => {
        updateStatus('last_cleanup', '2025-12-27');
        const status = getStatus();
        // Check that cleanup changed but db_ready stayed false
        expect(status.last_cleanup).toBe('2025-12-27');
        expect(status.db_ready).toBe(false);
    });
});