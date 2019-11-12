const winston = require("winston");

// list of logging levels in order
export const logLevels = ["error", "warn", "info", "verbose", "debug", "silly"];

// read in environment variables
const logLevel = process.env.RAPTOR_LOG_LEVEL && logLevels.includes(process.env.RAPTOR_LOG_LEVEL) ? process.env.RAPTOR_LOG_LEVEL : "info";
const logFile = process.env.RAPTOR_LOG_LOCATION || "/var/log/raptor/raptor.log";
const logToConsole = process.env.RAPTOR_LOG_TO_CONSOLE || false;

const printOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
};

const logFormat = winston.format.combine(
    winston.format.splat(),
    winston.format.timestamp({format: "YYYY-MM-DD HH:mm:ss"}),
    winston.format.printf(info => `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`)
);

export const logger = winston.createLogger({
    format: logFormat,
    transports: [
        new winston.transports.File({
            level: logLevel,
            filename: logFile,
            handleExceptions: true,
            json: true,
            maxsize: 52428800, // 50MB
            maxFiles: 5,
            colorize: false,
        }),
        new winston.transports.Console({
            level: logLevel,
            silent: !logToConsole,
            handleExceptions: true,
            json: true
        })
    ]
});
