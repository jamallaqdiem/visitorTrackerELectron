// server/db_management.js
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

//Automated cleanup of old backup files
function cleanOldBackups(backupDir, filePrefix, daysToRetain) {
  const cutoffTime = Date.now() - daysToRetain * 24 * 60 * 60 * 1000;

  try {
    const backupFiles = fs
      .readdirSync(backupDir)
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
      console.log(
        `Cleaned up ${deletedCount} old backup file(s) (older than ${daysToRetain} days).`
      );
    } else {
      console.log(
        `No backups found older than ${daysToRetain} days to clean up.`
      );
    }
  } catch (error) {
    console.error("Error during backup cleanup:", error.message);
  }
}

/**
 * Checks the database file for corruption using SQLite PRAGMA integrity_check.
 * @param {string} dbFilePath - Full path to the database file.
 * @returns {Promise<boolean>} Resolves to true if the database is OK, false otherwise.
 */
function checkDatabaseIntegrity(dbFilePath) {
  return new Promise((resolve) => {
    // 1. Check if the file exists at all
    if (!fs.existsSync(dbFilePath)) {
      console.log("Database file is missing (Integrity Check).");
      return resolve(false);
    }

    // 2. Open a read-only connection
    const db = new sqlite3.Database(
      dbFilePath,
      sqlite3.OPEN_READONLY,
      (err) => {
        if (err) {
          console.error(
            "Could not open database file for integrity check:",
            err.message
          );
          return resolve(false);
        }

        // 3. Run the PRAGMA check
        db.all("PRAGMA integrity_check", (pragmaErr, rows) => {
          db.close();

          if (pragmaErr) {
            console.error(
              "Error executing integrity check PRAGMA:",
              pragmaErr.message
            );
            return resolve(false);
          }

          const isCorrupt = rows.length > 0 && rows[0].integrity_check !== "ok";

          if (isCorrupt) {
            console.error(
              "Database corruption detected by PRAGMA integrity_check."
            );
          } else {
            console.log("Database integrity check passed. File is OK.");
          }

          resolve(!isCorrupt);
        });
      }
    );
  });
}

/**
 * Restores the latest good backup to the main database file path.
 * @param {string} dataPath - The base directory where 'database.db' and 'backups' are stored.
 * @param {string} dbFileName - The name of the database file (e.g., 'database.db').
 * @returns {boolean} True if a restore was successful, false otherwise.
 */
function restoreFromBackup(dataPath, dbFileName = "database.db") {
  const backupDir = path.join(dataPath, "backups");
  const dbFilePath = path.join(dataPath, dbFileName);

  console.log("Attempting database recovery...");

  if (!fs.existsSync(backupDir)) {
    console.log("No backup directory found. Cannot restore.");
    return false;
  }

  // Find all backup files and get the latest one
  const backupFiles = fs
    .readdirSync(backupDir)
    .filter(
      (file) =>
        file.startsWith(dbFileName.split(".")[0]) && file.endsWith(".db")
    )
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log("No backup files found. Cannot restore.");
    return false;
  }

  const latestBackupFile = backupFiles[0];
  const latestBackupPath = path.join(backupDir, latestBackupFile);

  try {
    // Copy the latest backup to the main database file path
    fs.copyFileSync(latestBackupPath, dbFilePath);
    console.log(
      `Successfully restored database from latest backup: ${latestBackupFile}`
    );
    return true;
  } catch (error) {
    console.error(`Error during database restoration:`, error.message);
    return false;
  }
}

/**
 * Creates a clean, time-stamped backup and deletes old backups.
 * @param {string} dbFilePath - Full path to the database file (source).
 * @param {string} dataPath - The base directory where 'backups' should be stored.
 * @returns {boolean} True if a backup was successful, false otherwise.
 */
function createBackup(dbFilePath, dataPath) {
  const backupDir = path.join(dataPath, "backups");
  const daysToRetain = 7; // Define the retention policy:  7 days of backups

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dbFileName = path.basename(dbFilePath); 
  
  // Define the prefix for use in the cleanup function call
  const backupFileNamePrefix = dbFileName.split(".")[0]; 
  
  const backupFileName = `${backupFileNamePrefix}-${dateStamp}.db`;
  const backupFilePath = path.join(backupDir, backupFileName);

  // Check if today's backup already exists
  if (fs.existsSync(backupFilePath)) {
    console.log(`Daily backup for ${dateStamp} already exists. Skipping.`);
    
    // Call cleanup even if skipping the copy
    cleanOldBackups(backupDir, backupFileNamePrefix, daysToRetain);
    return true;
  }

  try {
    // Use fs.copyFileSync for a simple copy operation
    fs.copyFileSync(dbFilePath, backupFilePath);
    console.log(`Automated Daily Backup created: ${backupFileName}`);
    
    // Call cleanup after a successful new backup is created
    cleanOldBackups(backupDir, backupFileNamePrefix, daysToRetain); 
    return true;
  } catch (error) {
    console.error(`Error creating automated backup:`, error.message);
    return false;
  }
}

module.exports = {
  checkDatabaseIntegrity,
  restoreFromBackup,
  createBackup,
};