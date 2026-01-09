const path = require('path');
const { app, initializeServer } = require('./server'); 

/**
 * Starts the Express server and returns the port it is listening on.
 * @param {string} userDataPath - Path provided by Electron for data storage
 * @returns {Promise<number>} The port number actually used.
 */

async function startServer(userDataPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Initialize EVERYTHING (DB, Config, Routes)
      // This ensures we have the config before starting the listener
      const config = await initializeServer(userDataPath);
      
      const logger = app.get('logger'); 
      const targetPort = config.PORT || 3001;

      const server = app.listen(targetPort, () => {
        if (logger && typeof logger.info === 'function') {
          logger.info(`🚀 Electron Backend successfully started on port: ${targetPort}`);
        } else {
          console.log(`🚀 Electron Backend started on port: ${targetPort}`);
        }
        resolve(targetPort);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${targetPort} is occupied.`));
        } else {
          reject(err);
        }
      });

    } catch (error) {
      console.error('Failed to initialize Express server:', error);
      reject(error);
    }
  });
}

module.exports = { startServer };