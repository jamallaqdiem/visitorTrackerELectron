
const appStatus = {
    // True if DB connection and initial integrity check passed
    db_ready: false, 
    // Latest time a successful backup was created
    last_backup: 'N/A', 
    // Latest time the data cleanup job successfully completed
    last_cleanup: 'N/A', 
    // Used to log the last severe error message (null if OK)
    last_error: null 
};

/**
 * Updates a specific key in the status object.
 * Useful for real-time health monitoring.
 */
function updateStatus(key, value) {
    appStatus[key] = value;
}

/**
 * Returns the current state of the application.
 */
function getStatus() {
    return appStatus;
}

module.exports = {
    updateStatus,
    getStatus
};