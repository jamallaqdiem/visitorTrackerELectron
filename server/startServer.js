// /server/startServer.js
const path = require('path');
// Import dotenv to load the PORT variable from the /server/.env file
require('dotenv').config({ path: path.join(__dirname, '.env') }); 

// Import the Express app instance exported from server.js
const app = require('./server'); 
const PORT = process.env.PORT || 3001; // Use the port defined in .env or default

/**
 * Starts the Express server and returns the port it is listening on.
 * @returns {Promise<number>} The port number.
 */
function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // Use the imported app instance to start listening
      const server = app.listen(PORT, () => {
        console.log(`Express server running on http://localhost:${PORT}`);
        resolve(PORT);
      });
      // Handle server errors during startup
      server.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      console.error('Failed to initialize Express server:', error);
      reject(error);
    }
  });
}

module.exports = { startServer };