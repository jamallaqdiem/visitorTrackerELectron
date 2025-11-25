require("dotenv").config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const app = express();
const PORT = 3001;
const CLIENT_BUILD_PATH = path.join(__dirname, "..", "client", "dist");

const runDataComplianceCleanup = require("./routes/clean_data");
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

// Global variables to hold initialized resources (db and upload)
let db = null;
let upload = null;
let UPLOADS_DIR_PATH = null; // Store the persistent uploads path here

// Define SQL commands
const visitorsSql = `CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  photo_path TEXT,
  is_banned BOOLEAN DEFAULT 0
)`;

const visitsSql = `CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY,
  visitor_id INTEGER NOT NULL,
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  known_as TEXT,
  address TEXT,
  phone_number TEXT,
  unit TEXT NOT NULL,
  reason_for_visit TEXT,
  type TEXT NOT NULL,
  company_name TEXT,
  mandatory_acknowledgment_taken BOOLEAN DEFAULT 0,
  FOREIGN KEY (visitor_id) REFERENCES visitors(id)
)`;

const dependentsSql = `CREATE TABLE IF NOT EXISTS dependents (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  visit_id INTEGER NOT NULL,
  FOREIGN KEY (visit_id) REFERENCES visits(id)
)`;

const auditLogsSql = `CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  event_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  profiles_deleted INTEGER,
  visits_deleted INTEGER,
  dependents_deleted INTEGER
)`;
// --- End SQL Commands ---

// --- INITIALIZATION FUNCTION ---
/**
 * Initializes the database and Multer instance using the persistent userDataPath.
 * This is called from startServer.js after the path has been set.
 */
const initializeServer = () => {
  // Retrieve the persistent data path set by startServer.js
  const userDataPath =
    app.get("userDataPath") || path.join(__dirname, "..", "..", "data"); // Define Paths
  const DB_FILE_PATH = path.join(userDataPath, "database.db");
  UPLOADS_DIR_PATH = path.join(userDataPath, "uploads"); // Set the global path variable // Ensure the uploads directory exists

  if (!fs.existsSync(UPLOADS_DIR_PATH)) {
    fs.mkdirSync(UPLOADS_DIR_PATH, { recursive: true });
  } // Set up multer for file uploads

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOADS_DIR_PATH);
    },
    filename: function (req, file, cb) {
      cb(
        null,
        file.fieldname + "-" + Date.now() + path.extname(file.originalname)
      );
    },
  }); // Store the initialized multer instance

  upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (["image/jpeg", "image/png", "image/gif"].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error("Invalid file type, only JPEG, PNG, or GIF is allowed!"),
          false
        );
      }
    },
  }); // Connect to SQLite database

  db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
      return console.error("Database connection error (Fatal):", err.message);
    }
    console.log("Connected to the database at:", DB_FILE_PATH);

    db.serialize(() => {
      // Create all tables
      db.run(visitorsSql, (err) => {
        if (err)
          return console.error("Visitors Table Error (Fatal):", err.message);
        db.run(visitsSql, (err) => {
          if (err)
            return console.error("Visits Table Error (Fatal):", err.message);
          db.run(dependentsSql, (err) => {
            if (err)
              return console.error(
                "Dependents Table Error (Fatal):",
                err.message
              );
            db.run(auditLogsSql, (err) => {
              if (err)
                return console.error(
                  "Audit Logs Table Error (Fatal):",
                  err.message
                ); // Running cleanup job.
              runDataComplianceCleanup(db);
            });
          });
        });
      });
    });
  });
};
// --- END INITIALIZATION FUNCTION ---

// CALL THE INITIALIZATION FUNCTION
initializeServer();

// --- Express Middleware and Routing ---

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Router usage (db and upload are now correctly initialized global variables)
app.use("/", createRegistrationRouter(db, upload));
app.use("/", createVisitorsRouter(db));
app.use("/", createLoginRouter(db));
app.use("/", createUpdateVisitorRouter(db));
app.use("/", createLogoutRouter(db));
app.use("/", createBanVisitorRouter(db));
app.use("/", createUnbanVisitorRouter(db));
app.use("/", createSearchVisitorsRouter(db));
app.use("/", createMissedVisitRouter(db));
app.use("/", createHistoryRouter(db));

app.use("/uploads", (req, res, next) => {
    const extension = path.extname(req.url).toLowerCase();
    
    // Set appropriate MIME types for common image files
    switch (extension) {
        case '.png':
            res.setHeader('Content-Type', 'image/png');
            break;
        case '.jpg':
        case '.jpeg':
            res.setHeader('Content-Type', 'image/jpeg');
            break;
        case '.gif':
            res.setHeader('Content-Type', 'image/gif');
            break;
        default:
            // Let the static handler handle other files or fail if it's not an image
            break;
    }
    next();
});
// Register static middleware  AFTER UPLOADS_DIR_PATH is set
app.use("/uploads", express.static(path.resolve(UPLOADS_DIR_PATH)));

// Serve the static files from the build path (e.g., JS, CSS)
app.use(express.static(CLIENT_BUILD_PATH));

app.get("*", (req, res, next) => {
  // Excluding API routes from this catch-all
  if (req.url.startsWith("/api/")) {
    return next();
  }
  res.sendFile(path.join(CLIENT_BUILD_PATH));
});

module.exports = app;
