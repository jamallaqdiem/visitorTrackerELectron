# Visitor Tracking Backend Server

This directory contains the Node.js/Express backend API for the Visitor Tracking and Management System. It is responsible for handling all persistent data storage (SQLite), processing administrative actions, and serving visitor data.

In the desktop application, this server is **launched by the Electron Main Process**.

***

### ⚙️ Dependencies and Setup

#### Installation

Ensure you are in the `/server` directory if installing dependencies specific to the server only:

```bash
npm install
Environment Variables
The server relies on environment variables for configuration and security. Create a file named .env in this directory and define the following variables:

PORT: The port on which the Express server will run (e.g., 3001). This is used by the Electron Main Process to know where to load the UI.

ADMIN_PASSWORD: The secret password required to authorize sensitive actions (e.g., BAN, UNBAN).

CLIENT_URL: (NOTE: This is not strictly required in Electron Approach A) since the client is served from the same localhost:PORT. You may omit or set it to http://localhost:3001.

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
