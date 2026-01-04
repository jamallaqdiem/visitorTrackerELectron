# Visitor Tracking & Management System - Electron Desktop Client

This is a comprehensive desktop application designed to manage, log, and track visitors (including professionals, contractors, and guests with dependents) in real-time. 

This project packages a Node.js/Express backend and a React/Vite frontend into a single, self-contained **Electron desktop application** tailored for operational needs.

> **Note on Origin:** This repository was created by mirroring the full commit history from the original web application repository: (https://github.com/jamallaqdiem/visitorTrackerApp).

***

### 📜 Architecture & Data Governance

**Architecture:** The application utilizes a "Standalone Sidecar" model:
* **Electron Main Process:** Manages system windows and launches the embedded Express server.
* **Express Server:** Handles API logic and serves the compiled React UI.
* **Bridge Layer:** A secure `preload.js` script allows the UI to detect system settings (like dynamic ports) without exposing Node.js to the frontend.

**Data Storage (Externalized):**
To ensure data persists through app updates, all variable data is stored **outside the application folder** in the system's standard user data directory (e.g., `AppData` on Windows or `Application Support` on macOS):
* `database.db`: The SQLite master file.
* `config.json`: System settings (Ports, Passwords, Sentry DSN).
* `/uploads`: Visitor photos.
* `/backups`: Automated daily snapshots (last 7 days).
* `/logs`: System and crash reports.

***

### 🚀 Key Features

* **Startup Crash Safeguard:** Includes a dedicated `startup-crash.log` file in the data folder that captures fatal errors occurring before the server or UI even initializes.
* **Resilient Data:** Startup integrity checks (`PRAGMA`) and automatic restoration from backups if corruption is detected.
* **Smart Port Management:** Automatically detects available ports to avoid conflicts with other software.
* **Administrative Security:** Password-protected history exports and visitor unbanning.
* **Privacy-First Monitoring:** Integrated Sentry error tracking that is only active if the user provides a DSN in the config file.
* **Audit Logging:** Local `.log` files track system health and client-side crashes for offline debugging.
* **Professional Registration:** Capture photos, track dependents, and manage "Banned" status.

***

### 🛠 Tech Stack

* **Client:** React, Vite, Tailwind CSS
* **Server:** Node.js, Express, SQLite3, Winston (Logging)
* **Runtime:** Electron
* **Monitoring:** Sentry (Optional/Configurable)

***

### 📁 Project Structure

* `/client/` - React Frontend Source.
* `/server/` - Express Backend & Database Management Logic.
* `main.js` - Electron entry point (handles window and server lifecycle).
* `preload.js` - Security layer for IPC communication.
* `package.json` - Root configuration and build scripts.

***

### ⚙️ Setup and Installation (For Developers)

#### 1. Prerequisites
You must have **Node.js (LTS)** installed.

#### 2. Installation & Build
Run the following in the root directory:
```bash
npm install
cd client && npm install && npm run build