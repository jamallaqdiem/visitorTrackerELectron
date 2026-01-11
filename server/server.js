const { app: electronApp } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const Sentry = require("@sentry/node");

/**
 * 1. UNIVERSAL PATH LOGIC (Windows & macOS)
 * Finds the correct folder for database, logs, and config.
 */
const getUniversalDataPath = () => {
  // If running inside Electron, use the official system-standard path
  if (electronApp) {
    return electronApp.getPath("userData");
  }

  // Fallback for local Node.js development
  const appName = "visitor-tracker-electron";
  if (process.platform === "win32") {
    return path.join(os.homedir(), "AppData", "Roaming", appName);
  } else if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", appName);
  } else {
    return path.join(os.homedir(), ".config", appName);
  }
};

const userDataPath = getUniversalDataPath();
const configPath = path.join(userDataPath, "config.json");

// Ensure the data directory exists immediately
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

/**
 * 2. STARTUP ERROR CATCHER
 * Saves fatal crashes to a local file in the AppData folder.
 */
process.on("uncaughtException", (err) => {
  const errorLogPath = path.join(userDataPath, "startup-crash.log");
  const errorMessage = `[${new Date().toISOString()}] CRASH: ${err.stack}\n`;

  fs.appendFileSync(errorLogPath, errorMessage);

  console.error("❌ THE APP CRASHED DURING STARTUP. Check startup-crash.log");
  process.exit(1);
});

/**
 * 3. CONFIG & SENTRY INITIALIZATION
 */
let config = {
  SENTRY_DSN: "",
  PORT: 3001,
  ADMIN_PASSWORD_1: "",
  ADMIN_PASSWORD_2: "",
};

try {
  if (fs.existsSync(configPath)) {
    const fileData = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config = { ...config, ...fileData };
  }
} catch (e) {
  console.error("⚠️ Error reading config:", e.message);
}

// Initialize Sentry ONLY if a DSN is provided in config.json
if (config.SENTRY_DSN && config.SENTRY_DSN.trim() !== "") {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
  console.log("🚀 Sentry Monitoring initialized.");
} else {
  console.log("🔒 Privacy Mode: Sentry is disabled (No DSN in data folder).");
}

/**
 * 4. MODULE IMPORTS
 */
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");

// Internal Module Imports
const { updateStatus, getStatus } = require("./status_tracker");
const {
  checkDatabaseIntegrity,
  restoreFromBackup,
  createBackup,
} = require("./db_management");
const createLogger = require("./logger");
const runDataComplianceCleanup = require("./routes/clean_data");

// Route Imports
const createAuditLogsRouter = require("./routes/audit_logs");
const createRegistrationRouter = require("./auth/registration");
const createVisitorsRouter = require("./routes/visitors");
const createLoginRouter = require("./routes/login");
const createUpdateVisitorRouter = require("./routes/update_visitor_details");
const createLogoutRouter = require("./routes/logout");
const createBanVisitorRouter = require("./routes/ban");
const createUnbanVisitorRouter = require("./routes/unban");
const createSearchVisitorsRouter = require("./routes/search_visitors");
const createMissedVisitRouter = require("./routes/record_missed_visit");
const createHistoryRouter = require("./routes/display_history");

// SQL Table Definitions
const visitorsSql = `CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, photo_path TEXT, is_banned BOOLEAN DEFAULT 0)`;
const visitsSql = `CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, visitor_id INTEGER NOT NULL, entry_time TEXT NOT NULL, exit_time TEXT, known_as TEXT, address TEXT, phone_number TEXT, unit TEXT NOT NULL, reason_for_visit TEXT, type TEXT NOT NULL, company_name TEXT, mandatory_acknowledgment_taken BOOLEAN DEFAULT 0, FOREIGN KEY (visitor_id) REFERENCES visitors(id))`;
const dependentsSql = `CREATE TABLE IF NOT EXISTS dependents (id INTEGER PRIMARY KEY, full_name TEXT NOT NULL, age INTEGER NOT NULL, visit_id INTEGER NOT NULL, FOREIGN KEY (visit_id) REFERENCES visits(id))`;
const auditLogsSql = `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, event_name TEXT NOT NULL, timestamp TEXT NOT NULL, status TEXT NOT NULL, profiles_deleted INTEGER, visits_deleted INTEGER, dependents_deleted INTEGER)`;

const app = express();
let logger = console; // Placeholder until createLogger runs

/**
 * 5. INITIALIZATION FUNCTION
 */
const initializeServer = async (passedPath) => {
  const targetPath = passedPath || userDataPath;

  // Ensure system subfolders exist
  ["uploads", "logs", "backups"].forEach((dir) => {
    const fullPath = path.join(targetPath, dir);
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  });

  const LOG_DIR_PATH = path.join(targetPath, "logs");
  const DB_FILE_PATH = path.join(targetPath, "database.db");
  const UPLOADS_DIR_PATH = path.join(targetPath, "uploads");
  let CLIENT_BUILD_PATH = path.join(__dirname, "..", "client", "dist");
  // Fallback if the folder is flat inside the production app
if (!fs.existsSync(CLIENT_BUILD_PATH)) {
  CLIENT_BUILD_PATH = path.join(__dirname, "client", "dist");
}

  // Load final config from the target path
  const finalConfig = { ...config };
  app.set("config", finalConfig);

  logger = createLogger(LOG_DIR_PATH);
  app.set("logger", logger);

  // DB Integrity Check
  let isDatabaseClean = await checkDatabaseIntegrity(DB_FILE_PATH, logger);
  if (!isDatabaseClean && fs.existsSync(DB_FILE_PATH)) {
    restoreFromBackup(targetPath, logger);
    isDatabaseClean = await checkDatabaseIntegrity(DB_FILE_PATH, logger);
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
      if (err) return reject(err);

      updateStatus("db_ready", true);
      createBackup(DB_FILE_PATH, targetPath, logger);

      db.serialize(() => {
        db.run(visitorsSql);
        db.run(visitsSql);
        db.run(dependentsSql);
        db.run(auditLogsSql, (err) => {
          if (err) return reject(err);

          runDataComplianceCleanup(db, logger);

          const storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, UPLOADS_DIR_PATH),
            filename: (req, file, cb) =>
              cb(
                null,
                `${file.fieldname}-${Date.now()}${path.extname(
                  file.originalname
                )}`
              ),
          });
          const upload = multer({ storage });

          attachRoutes(db, upload, targetPath, CLIENT_BUILD_PATH, finalConfig);
          resolve(finalConfig);
        });
      });
    });
  });
};

/**
 * 6. ROUTE ATTACHMENT
 */
function attachRoutes(db, upload, targetPath, CLIENT_BUILD_PATH, config) {
  app.use("/", express.static(targetPath));
  app.use(cors({
  origin: '*', // Allows the 'file://' frontend to talk to the 'http://' backend
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // --- FRONTEND LOG BRIDGE ---
  app.post("/api/logs/log-error", (req, res) => {
    const { error, info, type } = req.body;
    const currentLogger = app.get("logger") || console;
    const shortStack = error?.stack 
        ? error.stack.split('\n').slice(0, 3).join(' | ') 
        : "No stack";
    currentLogger.error(`${type} | ${error?.message} | ${shortStack}`);
    res.status(200).json({ status: "logged" });
  });

  app.use("/uploads", express.static(path.join(targetPath, "uploads")));
  app.use(express.static(CLIENT_BUILD_PATH));

  // API Routes
  app.use("/", createRegistrationRouter(db, upload, logger));
  app.use("/", createVisitorsRouter(db, logger));
  app.use("/", createLoginRouter(db, logger));
  app.use("/", createUpdateVisitorRouter(db, logger));
  app.use("/", createLogoutRouter(db, logger));
  app.use("/", createBanVisitorRouter(db, logger));
  app.use("/", createUnbanVisitorRouter(db, logger, config.ADMIN_PASSWORD_2));
  app.use("/", createSearchVisitorsRouter(db, logger));
  app.use("/", createMissedVisitRouter(db, logger));
  app.use("/", createHistoryRouter(db, logger, config.ADMIN_PASSWORD_1));
  app.use("/api/audit", createAuditLogsRouter(db, logger));

  if (config.SENTRY_DSN) Sentry.setupExpressErrorHandler(app);

  app.get("/api/status", (req, res) => res.json(getStatus()));

  // SPA Catch-all
  app.get("*splat", (req, res) => {
    if (!req.url.startsWith("/api/")) {
      const idx = path.join(CLIENT_BUILD_PATH, "index.html");
      if (fs.existsSync(idx)) res.sendFile(idx);
      else res.status(404).send("Frontend build not found.");
    }
  });

  logger.info("✅ Server logic initialized and routes attached.");
}

module.exports = { app, initializeServer };
