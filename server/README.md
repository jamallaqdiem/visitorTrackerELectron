# Visitor Tracking - Express Backend

The core engine of the application, handling data persistence, image storage, and system health.

## 💾 Data Management
* **Database:** SQLite3 (`database.db`).
* **Integrity:** On every startup, the server runs `PRAGMA integrity_check`. If corruption is detected, it automatically restores from the latest backup.
* **Backups:** Automated daily backups are stored in the `/backups` folder with a 7-day retention policy.
* **Compliance:** Automated data cleanup routines ensure old visit records are handled according to policy.

## 📝 Logging & Monitoring
* **Winston Logger:** Rotating log files are stored in `/logs`.
* **Sentry:** Integrated for both the Node.js process and the Electron Main process.
* **Audit Logs:** Tracks sign-ins, sign-outs, and system errors for administrative review.

## 🔐 Configuration (`config.json`)
The server reads settings from the system's UserData folder:
- `PORT`: Preferred port (defaults to 3001).
- `ADMIN_PASSWORD_1`: History/Export access.
- `ADMIN_PASSWORD_2`: Unban permissions.
- `SENTRY_DSN`: Remote error tracking key.

***

### ⚙️ Dependencies and Setup

#### Installation

Ensure you are in the `/server` directory if installing dependencies specific to the server only:

```bash
npm install

Database
This application uses a file-based SQLite3 database. The file is located at server/db/visitors.db.

The server.js file handles the initial connection and table creation if the database does not exist.

💾 Database Schema Overview (SQLite)
The core data is managed across three main tables:

Table: visitors (Visitor Master Data)

visitor_id, first_name, last_name, photo_path, is_banned, created_at

Table: visits (Sign-In/Sign-Out Logs)

visit_id, visitor_id, unit, phone_number, type, company_name, reason_for_visit, entry_time, exit_time, notes

Table: dependents (Guest Dependent Details)

dependent_id, visitor_id, full_name, age

🌐 API Endpoints
All endpoints are prefixed with /api. These REST endpoints are accessed by the React client via HTTP requests to localhost:PORT when running in the Electron environment.

POST /api/register

GET /api/visitors (Currently Signed In)

GET /api/visitors/:id

PUT /api/update/:id

POST /api/signout/:id

POST /api/ban/:id

POST /api/unban/:id

GET /api/export-history/:id

🧪 Testing
Testing is implemented using Node.js's built-in testing utilities (or Jest/Mocha if configured).

To run all tests:

Bash

npm test
