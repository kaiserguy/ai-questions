/**
 * Centralized logging utility using Winston
 * Provides consistent logging across the application
 */

const winston = require('winston');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// Define colors for console output
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
};

winston.addColors(colors);

// Create format for console output
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(
        info => `${info.timestamp} [${info.level}]: ${info.message}`
    )
);

// Create format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
    levels: levels,
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat
        }),
        // Error file transport
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: fileFormat
        }),
        // Combined file transport
        new winston.transports.File({
            filename: 'logs/combined.log',
            format: fileFormat
        })
    ],
    // Don't exit on handled exceptions
    exitOnError: false
});

// Handle uncaught exceptions and unhandled promise rejections
logger.exceptions.handle(
    new winston.transports.File({ filename: 'logs/exceptions.log' })
);

logger.rejections.handle(
    new winston.transports.File({ filename: 'logs/rejections.log' })
);

module.exports = logger;
