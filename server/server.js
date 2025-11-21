require('dotenv').config();
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const app = express();
const PORT = 3001;

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

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure the uploads directory exists
const uploadsDir = "uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20Mb size limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/gif"
    ) {
      cb(null, true); // accept
    } else {
      cb(
        new Error("Invalid file type, only JPEG, PNG, or GIF is allowed!"),
        false
      ); // reject
    }
  },
});

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

// Connect to SQLite database
const db = new sqlite3.Database("database.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the database.");

    db.serialize(() => {
      // 1. Create Visitors table
      db.run(visitorsSql, (err) => {
        if (err) {
          return console.error("Visitors Table Error (Fatal):", err.message);
        }

        // 2. Create Visits table
        db.run(visitsSql, (err) => {
          if (err) {
            return console.error("Visits Table Error (Fatal):", err.message);
          }

          // 3. Create Dependents table
          db.run(dependentsSql, (err) => {
            if (err) {
              return console.error(
                "Dependents Table Error (Fatal):",
                err.message
              );
            }

            // 4. Create Audit Logs table
            db.run(auditLogsSql, (err) => {
              if (err) {
                return console.error(
                  "Audit Logs Table Error (Fatal):",
                  err.message
                );
              }
              // Running cleanup job.
              runDataComplianceCleanup(db);
            });
          });
        });
      });
    });
  }
});

// Router usage
app.use("/", createRegistrationRouter(db,upload));
app.use("/", createVisitorsRouter(db));
app.use("/", createLoginRouter(db));
app.use("/", createUpdateVisitorRouter(db));
app.use("/", createLogoutRouter(db));
app.use("/", createBanVisitorRouter(db));
app.use("/", createUnbanVisitorRouter(db));
app.use("/", createSearchVisitorsRouter(db)); 
app.use("/", createMissedVisitRouter(db)); 
app.use("/", createHistoryRouter(db));

module.exports = app;