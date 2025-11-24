
const path = require('path');
const { startServer } = require('./server/startServer');
const { app, BrowserWindow, ipcMain } = require('electron'); 
let mainWindow;
let userDataPath; // path to store .db and uplaods folder outside of .exe 
const createWindow = async () => {
  userDataPath = app.getPath('userData');
  // 1. START THE NODE.JS SERVER and WAIT for the port
  const port = await startServer(userDataPath); 

  // 2. Create the Browser Window
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      // Standard security settings for loading an external (localhost) resource
      nodeIntegration: false,
      contextIsolation: true, 
      preload: path.join(__dirname, 'preload.js'), 
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

// --- IPC HANDLERS ---
// Listener for the 'app:close' signal sent from the preload script/renderer
ipcMain.on('app:close', () => {
  app.quit();
});