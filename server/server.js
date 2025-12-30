
const Sentry = require("@sentry/electron/main");// Electron SDK
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Internal Module Imports
const { updateStatus, getStatus } = require("./status_tracker");
const { checkDatabaseIntegrity, restoreFromBackup, createBackup } = require("./db_management");
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

const app = express();
let logger = console; // Initial fallback

/**
 * 1. DYNAMIC CONFIGURATION HANDLER
 * Loads or creates config.json in the userData folder.
 */
const getExternalConfig = (userDataPath) => {
    const configPath = path.join(userDataPath, "config.json");
    const defaultSettings = {
        PORT: 3001,
        ADMIN_PASSWORD_1: "",
        ADMIN_PASSWORD_2: "",
        SENTRY_DSN: "" 
    };

    let config;

    // 1. If file doesn't exist, create it and return defaults
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }

    // 2. Try to read the existing file
    try {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (err) {
        return defaultSettings;
    }

    // 3. NOW check for empty passwords safely
    if (!config.ADMIN_PASSWORD_1 || config.ADMIN_PASSWORD_1.trim() === "") {
        console.warn("SECURITY ALERT: ADMIN_PASSWORD_1 is empty!");
    }
    if (!config.ADMIN_PASSWORD_2 || config.ADMIN_PASSWORD_2.trim() === "") {
        console.warn("SECURITY ALERT: ADMIN_PASSWORD_2 is empty!");
    }

    return config;
};

// --- SQL Table Definitions ---
const visitorsSql = `CREATE TABLE IF NOT EXISTS visitors (id INTEGER PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, photo_path TEXT, is_banned BOOLEAN DEFAULT 0)`;
const visitsSql = `CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, visitor_id INTEGER NOT NULL, entry_time TEXT NOT NULL, exit_time TEXT, known_as TEXT, address TEXT, phone_number TEXT, unit TEXT NOT NULL, reason_for_visit TEXT, type TEXT NOT NULL, company_name TEXT, mandatory_acknowledgment_taken BOOLEAN DEFAULT 0, FOREIGN KEY (visitor_id) REFERENCES visitors(id))`;
const dependentsSql = `CREATE TABLE IF NOT EXISTS dependents (id INTEGER PRIMARY KEY, full_name TEXT NOT NULL, age INTEGER NOT NULL, visit_id INTEGER NOT NULL, FOREIGN KEY (visit_id) REFERENCES visits(id))`;
const auditLogsSql = `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, event_name TEXT NOT NULL, timestamp TEXT NOT NULL, status TEXT NOT NULL, profiles_deleted INTEGER, visits_deleted INTEGER, dependents_deleted INTEGER)`;

/**
 * 2. INITIALIZATION FUNCTION
 */
const initializeServer = async () => {
    const userDataPath = app.get("userDataPath") || path.join(__dirname, "..", "..", "data");
    const CLIENT_BUILD_PATH = path.join(__dirname, "..", "client", "dist");
    
    // A. Load Config & Setup Sentry (Fail-safe)
    const config = getExternalConfig(userDataPath);
    app.set("logger", logger); 

    if (config.SENTRY_DSN && config.SENTRY_DSN.trim() !== "") {
        try {
            Sentry.init({ dsn: config.SENTRY_DSN, tracesSampleRate: 1.0 });
            Sentry.setupExpressErrorHandler(app);
            logger?.info("Sentry initialized successfully.");
        } catch (e) {
            logger?.warn("Sentry failed to initialize. Moving on...");
        }
    } else {
        logger?.info("No Sentry DSN found in config. Moving on without error tracking.");
    }

    // B. Setup Folders & Logging
    const DB_FILE_PATH = path.join(userDataPath, "database.db");
    const UPLOADS_DIR_PATH = path.join(userDataPath, "uploads");
    const LOG_DIR_PATH = path.join(userDataPath, "logs");

    if (!fs.existsSync(UPLOADS_DIR_PATH)) fs.mkdirSync(UPLOADS_DIR_PATH, { recursive: true });
    logger = createLogger(LOG_DIR_PATH);
    logger?.info("Initializing Electron Server...");

    // C. Database ?Recovery & Integrity
    let isDatabaseClean = await checkDatabaseIntegrity(DB_FILE_PATH, logger);
    if (!isDatabaseClean) {
        restoreFromBackup(userDataPath, logger);
        isDatabaseClean = await checkDatabaseIntegrity(DB_FILE_PATH, logger);
    }

    // D. Multer Setup
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR_PATH),
        filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`)
    });
    const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

    // E. DB Connection
    const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
        if (err) {
            logger?.error(`Database error: ${err.message}`);
            return;
        }
        updateStatus("db_ready", true);
        createBackup(DB_FILE_PATH, userDataPath, logger);

        db.serialize(() => {
            db.run(visitorsSql);
            db.run(visitsSql);
            db.run(dependentsSql);
            db.run(auditLogsSql, (err) => {
                if (!err) {
                    runDataComplianceCleanup(db, logger);
                    attachRoutes(db, upload, UPLOADS_DIR_PATH, CLIENT_BUILD_PATH,config);
                }
            });
        });
    });
    return config;
};

/**
 * 3. ROUTE ATTACHMENT
 */
function attachRoutes(db, upload, UPLOADS_DIR_PATH, CLIENT_BUILD_PATH,config) {
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // Routes
    app.use("/", createRegistrationRouter(db, upload, logger));
    app.use("/", createVisitorsRouter(db, logger));
    app.use("/", createLoginRouter(db, logger));
    app.use("/", createUpdateVisitorRouter(db, logger));
    app.use("/", createLogoutRouter(db, logger));
    app.use("/", createBanVisitorRouter(db, logger));
    app.use("/", createUnbanVisitorRouter(db, logger,config.ADMIN_PASSWORD_2));
    app.use("/", createSearchVisitorsRouter(db, logger));
    app.use("/", createMissedVisitRouter(db, logger));
    app.use("/", createHistoryRouter(db, logger,config.ADMIN_PASSWORD_1));
    app.use("/api/audit", createAuditLogsRouter(db, logger));

    app.get("/api/status", (req, res) => res.json(getStatus()));

    app.use("/uploads", express.static(UPLOADS_DIR_PATH));
    app.use(express.static(CLIENT_BUILD_PATH));

    app.get("*", (req, res) => {
        if (!req.url.startsWith("/api/")) {
            res.sendFile(path.join(CLIENT_BUILD_PATH, "index.html"));
        }
    });

    logger.info("✅ All routes successfully attached.");
}

// Start Initialization
const startExpress = async () => {
    try {
        // This now returns the config so we can use it
        const config = await initializeServer(); 
        const port = config.PORT || 3001;

        app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
        });
    } catch (err) {
        console.error("FATAL: Could not start Express server", err);
    }
};

if (require.main === module) {
    startExpress();
}

module.exports = app;