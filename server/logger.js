const winston = require("winston");
require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");

/**
 * Factory function to create a logger .
 * @param {string} logDir - The directory where logs should be stored (usually in AppData).
 */
const createLogger = (logDir) => {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return winston.createLogger({
    level: "warn",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        level: "warn",
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
      new winston.transports.DailyRotateFile({
        level: "warn",
        filename: path.join(logDir, "application-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "60d", // Data retention for compliance
      }),
    ],
  });
};

module.exports = createLogger;