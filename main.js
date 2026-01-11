const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
} = require("electron");
const createLogger = require("./server/logger");
const path = require("path");
const fs = require("fs");
const Sentry = require("@sentry/electron/main");
const { startServer } = require("./server/startServer");

let mainWindow;
let f12Timer; // A variable to hold   for DevTools
const userDataPath = app.getPath("userData");

// 1. Ensure the directory exists immediately
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// 2. EARLY INITIALIZATION (Sentry & Config)
const configPath = path.join(userDataPath, "config.json");
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.SENTRY_DSN) {
      Sentry.init({ dsn: config.SENTRY_DSN });
    }
  }
} catch (err) {
  console.error("Main Process: Could not initialize Sentry", err);
}

app.disableHardwareAcceleration();

/**
 * 3. PDF GENERATION HANDLER
 * Intercepts the request from the frontend to generate a professional PDF.
 * Saves to the system Downloads folder and opens it automatically.
 */
ipcMain.on("generate-pdf", async (event) => {
  if (!mainWindow) return;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `Visitor_History_Report_${timestamp}.pdf`;
    const pdfPath = path.join(app.getPath("downloads"), fileName);

    const options = {
      marginsType: 0, // No margins for full Tailwind design coverage
      pageSize: "A4",
      printBackground: true, // Captures colors and table styling
      landscape: true, // Horizontal layout is better for wide visitor tables
    };

    const data = await mainWindow.webContents.printToPDF(options);

    fs.writeFile(pdfPath, data, (error) => {
      if (error) {
        console.error("PDF Save Error:", error);
        return;
      }
      // Open the file immediately so the user can see/print it
      shell.openPath(pdfPath);
      console.log(`PDF successfully saved to: ${pdfPath}`);
    });
  } catch (err) {
    console.error("Failed to generate PDF:", err);
  }
});

const createWindow = async () => {
  const logDir = path.join(userDataPath, "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const logger = createLogger(logDir);
  Menu.setApplicationMenu(null); // Keep UI clean

  try {
    logger.info("[Main Process] Starting backend server...");
    const port = await startServer(userDataPath);
    logger.info(`[Main Process] Backend ready on port ${port}.`);

    // Handle port request from Frontend
    ipcMain.handle("get-port", () => port);

    mainWindow = new BrowserWindow({
      width: 1200, // Slightly wider for better table visibility
      height: 850,
      backgroundColor: "#ffffff",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // Hidden Debugging Tools for Production
 mainWindow.webContents.on("before-input-event", (event, input) => {
  if (input.key === "F12") {
    if (input.type === "keyDown") {
      // If  just pressed , start a timer for 3 seconds
      if (!f12Timer) {
        f12Timer = setTimeout(() => {
          mainWindow.webContents.toggleDevTools();
          console.log("Secret DevTools activated via Long Press!");
        }, 3000); 
      }
    } else if (input.type === "keyUp") {
      // If  let go before 3 seconds, cancel the timer!
      clearTimeout(f12Timer);
      f12Timer = null;
    }
  }
});

    const isDev = !app.isPackaged;

    if (isDev) {
      mainWindow.loadURL("http://localhost:5173");
    } else {
      // Robust pathing for the production .EXE
      const indexPath = path.join(__dirname, "client", "dist", "index.html");
      if (fs.existsSync(indexPath)) {
        mainWindow.loadFile(indexPath);
      } else {
        // Fallback for different build structures
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
      }
    }
    // Clean the RAM
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[Main Process] FATAL ERROR during startup:", error);
    dialog.showErrorBox("Startup Error", `Server failed: ${error.message}`);
    app.quit();
  }
};

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("app:close", () => {
  app.quit();
});
