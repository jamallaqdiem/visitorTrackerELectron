const path = require('path');
const app = require('./server'); // This is your Express app

/**
 * Starts the Express server and returns the port it is listening on.
 * @param {string} userDataPath - Path provided by Electron for data storage
 * @returns {Promise<number>} The port number actually used.
 */
function startServer(userDataPath) {
  return new Promise((resolve, reject) => {
    // 1. Pass the path to the app
    app.set('userDataPath', userDataPath);

    try {
      // 2. We access the config and logger from the app instance.
      const config = app.get('config') || { PORT: 3001 };
      const logger = app.get('logger'); 
      
      const targetPort = config.PORT;

      const server = app.listen(targetPort, () => {
        if (logger) {
          logger.info(`🚀 Electron Backend successfully started on port: ${targetPort}`);
        } else {
          console.log(`🚀 Electron Backend started on port: ${targetPort} (Logger not yet ready)`);
        }
        resolve(targetPort);
      });

      // Handle server errors during startup
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          if (logger) {
            logger.error(`Critical Error: Port ${targetPort} is already in use.`);
          }
          reject(new Error(`Port ${targetPort} is occupied.`));
        } else {
          if (logger) logger.error(`Server startup error: ${err.message}`);
          reject(err);
        }
      });

    } catch (error) {
      // If everything fails, we use console as a last resort
      console.error('Failed to initialize Express server:', error);
      reject(error);
    }
  });
}

module.exports = { startServer };