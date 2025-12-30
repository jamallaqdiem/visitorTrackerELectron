const { app, BrowserWindow, ipcMain, dialog } = require('electron'); 
const createLogger = require('./server/logger');
const path = require('path');
const fs = require('fs'); // Added for reading config
const Sentry = require("@sentry/electron/main");// Electron SDK
const { startServer } = require('./server/startServer');

let mainWindow;
let userDataPath; 

// 1. EARLY INITIALIZATION (Sentry & Config)
userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, "config.json");

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.SENTRY_DSN) {
      Sentry.init({ dsn: config.SENTRY_DSN });
    }
  }
} catch (err) {
  console.error("Main Process: Could not initialize Sentry", err);
}

app.disableHardwareAcceleration();

const createWindow = async () => {
  const logDir = path.join(userDataPath, 'logs');
  const logger = createLogger(logDir);

  try {
    logger.info('[Main Process] Attempting to start backend server...');
    
    // This calls startServer which returns the port from config.json
    const port = await startServer(userDataPath); 
    
    logger.info(`[Main Process] Backend ready on port ${port}. Creating window...`);

    mainWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true, 
        preload: path.join(__dirname, 'preload.js'), 
      },
    });

    // Load URL using the dynamic port
    mainWindow.loadURL(`http://localhost:${port}`);

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logger.error(`[Main Process] Failed to load UI: ${errorDescription} (${errorCode})`);
    });

    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

  } catch (error) {
    Sentry.captureException(error); // Send startup errors to Sentry
    logger.error('[Main Process] FATAL ERROR during startup:', error);
    
    dialog.showErrorBox(
      'Application Startup Error',
      `The server failed to start.\n\nError: ${error.message}`
    );
    app.quit();
  }
};

// Lifecycle Handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('app:close', () => {
  app.quit();
});