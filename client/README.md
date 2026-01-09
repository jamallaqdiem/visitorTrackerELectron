### 3. Visitor Tracking Frontend Client

This file needs significant updating to remove references to the separate `npm run dev` and `http://localhost:5173`.

```markdown
# Visitor Tracking Client Application

This directory contains the frontend client built with **React and Vite**, styled using **Tailwind CSS**. This application is responsible for the user interface and handling all necessary API calls to the embedded backend server.


This is the React-based user interface. In production, it is served as a static build by the Express backend.

## 🛠 Features
* **Live Search:** Debounced visitor lookup to prevent duplicate profiles.
* **Context Bridge:** Uses `window.apiConfig` to securely communicate with the Electron Main process.
* **Error Boundary:** Catches UI crashes and reports them to the local backend log files.
* **Dynamic Base URL:** Automatically connects to the backend via the port provided by the Electron bridge.

#### 1. Prerequisites & Installation

All client dependencies are installed via the root `npm install` command, but to ensure the `node_modules` are present in this subdirectory:

```bash
npm install
2. Building for Electron
The client must be compiled into static files (HTML, JS, CSS) before the Electron Main Process can serve it. This build must be run before starting the main application.

Bash

npm run build 
# or
yarn build
The output will be placed in the /client/build folder.

3. Running
To run the client, navigate back to the root of the project and execute the Electron command, which automatically starts the server that hosts this client:

Bash

cd ..
npm run electron-dev 
# or
npm start
🛠️ Technology Stack
React: Core library for the UI components.

Vite: Frontend tooling for fast building and development.

Tailwind CSS: Utility-first CSS framework for styling and responsive design.

📡 API Interaction
All communication with the backend is handled asynchronously via standard HTTP requests (e.g., fetch or axios) to the embedded Express server at http://localhost:PORT. No changes to API interaction are required in the React code for Approach A.

The primary API endpoint for real-time data is GET /api/visitors.

Sensitive actions like Ban/Unban utilize POST requests containing the administrative password.