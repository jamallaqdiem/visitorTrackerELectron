// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer } = require('./server/startServer'); // Import the new module

let mainWindow;

const createWindow = async () => {
  // 1. START THE NODE.JS SERVER and WAIT for the port
  const port = await startServer(); 

  // 2. Create the Browser Window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      // Standard security settings for loading an external (localhost) resource
      nodeIntegration: false,
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js'), // Keep your preload script
    },
  });

  // 3. LOAD THE WINDOW from the server's local address
  mainWindow.loadURL(`http://localhost:${port}`);

  // Open the DevTools only in development 
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Handle closing event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Electron Lifecycle Handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});