# Visitor Tracking and Management System - Electron Desktop Client

This is a comprehensive desktop application designed to manage, log, and track visitors (including professionals, contractors, and guests with dependents) in real-time.

This project packages the original Node.js/Express backend and the React/Vite frontend into a single, self-contained **Electron desktop application**.

***

### 📜 Project Origin and Architecture

This repository was created by **mirroring the full commit history** from the original web application repository.

**Architecture:** This application utilizes **Electron's Approach A (Standalone Server)** model:
* The **Electron Main Process** launches the embedded Node.js/Express backend.
* The **Express Server** serves the compiled React UI via a local `http://localhost:3001` address.
* All data is stored in the local, file-based **SQLite database (`visitors.db`)**.

***

### 🚀 Features

**Frontend (Client)**
* Real-time Status Display
* Visitor Registration (Professionals, Contractors, Guests with dependents)
* Mandatory photo upload/capture.
* Visitor Management Screen for search and updates.
* Administrative Actions (Secure Ban/Unban).
* Data Export to CSV.

**Backend (Server)**
* Node.js/Express API structure.
* SQLite3 Database persistence.
* Secure Admin functionality.
* Dedicated REST API Endpoints.

***

### 🛠️ Tech Stack

**Client (Frontend)**
* React, Vite, Tailwind CSS

**Server (Backend) & Desktop Runtime**
* Node.js & Express, SQLite3
* **Electron:** Desktop framework
* DOTENV

***

### 📁 Project Structure

The repository maintains its mono-repo structure, now integrated with Electron files:

* `/client/`                  (React Frontend - Source Code)
* `/server/`                  (Node.js/Express Backend - Server Logic)
* `main.js`                   (Electron Main Process Entry Point)
* `preload.js`                (Electron Security Bridge)
* `package.json`              (Root dependencies and Electron config)
* `/client/build`             (Where the compiled React files go)
* `/server/Uploads`           (Folder for image storage)

***

### ⚙️ Setup and Installation (For Developers)

Follow these steps to set up and run the application locally for development.

#### 1. Prerequisites

You must have **Node.js (LTS)** and **npm/Yarn** installed.

#### 2. Install Root Dependencies

Run the installation command in the **root directory** of the project:

```bash
npm install 
# or 
yarn install



3. Build the React Client
Navigate to the client directory and build the production-ready React assets. This step is mandatory as Electron needs the compiled files.

Bash

cd client
npm install
npm run build 
# or
yarn build
4. Configure Environment Variables
Create a file named .env inside the /server directory. Copy the content from .env.example and fill in the values.

Note: In the Electron environment, the PORT variable should typically be set to a static port like 3001.

5. Run the Electron Application
Navigate back to the root directory and run the Electron development script:

Bash

cd ..
npm run electron-dev 
# or simply:
npm start
The Electron window will launch, automatically starting the Node.js server and loading the UI from localhost.