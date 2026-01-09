const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { updateStatus } = require("./status_tracker");

// Automated cleanup of old backup files
function cleanOldBackups(backupDir, filePrefix, daysToRetain, logger) {
    const cutoffTime = Date.now() - daysToRetain * 24 * 60 * 60 * 1000;
    try {
        const backupFiles = fs.readdirSync(backupDir)
            .filter((file) => file.startsWith(filePrefix) && file.endsWith(".db"));

        let deletedCount = 0;
        backupFiles.forEach((file) => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < cutoffTime) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            logger?.info(`Cleaned up ${deletedCount} old backup file(s) (older than ${daysToRetain} days).`);
        }
    } catch (error) {
        logger?.error(`Error during backup cleanup: ${error.message}`);
    }
}

/**
 * Checks the database file for corruption.
 */
function checkDatabaseIntegrity(dbFilePath, logger) {
    return new Promise((resolve) => {
        if (!fs.existsSync(dbFilePath)) {
            logger?.warn("Database file is missing (Integrity Check).");
            return resolve(false);
        }

        const db = new sqlite3.Database(dbFilePath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                logger?.error(`Could not open database file for integrity check: ${err.message}`);
                return resolve(false);
            }

            db.all("PRAGMA integrity_check", (pragmaErr, rows) => {
                db.close();
                if (pragmaErr) {
                    logger?.error(`Error executing integrity check PRAGMA: ${pragmaErr.message}`);
                    return resolve(false);
                }

                const isCorrupt = rows.length > 0 && rows[0].integrity_check !== "ok";
                if (isCorrupt) {
                    logger?.error("CRITICAL: Database corruption detected by PRAGMA integrity_check.");
                } else {
                    logger?.info("Database integrity check passed. File is OK.");
                }
                resolve(!isCorrupt);
            });
        });
    });
}

/**
 * Restores latest good backup.
 */
function restoreFromBackup(dataPath, dbFileName = "database.db", logger = null) {
    const backupDir = path.join(dataPath, "backups");
    const dbFilePath = path.join(dataPath, dbFileName);

    logger?.warn("Attempting database recovery from backup...");

    if (!fs.existsSync(backupDir)) {
        logger?.error("No backup directory found. Recovery impossible.");
        return false;
    }

    const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith(dbFileName.split(".")[0]) && file.endsWith(".db"))
        .sort().reverse();

    if (backupFiles.length === 0) {
        logger?.error("No backup files found. Recovery impossible.");
        return false;
    }

    const latestBackupFile = backupFiles[0];
    const latestBackupPath = path.join(backupDir, latestBackupFile);

    try {
        fs.copyFileSync(latestBackupPath, dbFilePath);
        logger?.info(`Successfully restored database from: ${latestBackupFile}`);
        return true;
    } catch (error) {
        logger?.error(`Error during database restoration: ${error.message}`);
        return false;
    }
}

/**
 * Creates a backup.
 */
function createBackup(dbFilePath, dataPath, logger) {
    const backupDir = path.join(dataPath, "backups");
    const daysToRetain = 7;

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const dbFileName = path.basename(dbFilePath);
    const backupFileNamePrefix = dbFileName.split(".")[0];
    const backupFileName = `${backupFileNamePrefix}-${dateStamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    if (fs.existsSync(backupFilePath)) {
        updateStatus("last_backup", new Date().toISOString()); 
        cleanOldBackups(backupDir, backupFileNamePrefix, daysToRetain, logger);
        return true;
        return true;
    }

    try {
        fs.copyFileSync(dbFilePath, backupFilePath);
        logger?.info(`Automated Daily Backup created: ${backupFileName}`);
        updateStatus("last_backup", new Date().toISOString());
        cleanOldBackups(backupDir, backupFileNamePrefix, daysToRetain, logger);
        return true;
    } catch (error) {
        logger?.error(`Error creating automated backup: ${error.message}`);
        return false;
    }
}

module.exports = { checkDatabaseIntegrity, restoreFromBackup, createBackup };