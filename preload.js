const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that the renderer process (React UI) can use.
contextBridge.exposeInMainWorld('electron', {
  // Utility to get basic app info if needed for debugging
  getAppInfo: () => ({
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  }),
  
  //A secure way to close the application from the UI (if needed)
  closeApp: () => ipcRenderer.send('app:close')
});

contextBridge.exposeInMainWorld('apiConfig', {
   getPort: () => ipcRenderer.invoke('get-port'),
   saveAsPDF: () => ipcRenderer.send('generate-pdf'),
});