const winston = require("winston");

// list of logging levels in order
export const logLevels = ["error", "warn", "info", "verbose", "debug", "silly"];

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
            level: "info",
            filename: `/var/log/raptor/raptor.log`,
            handleExceptions: true,
            json: true,
            maxsize: 52428800, // 50MB
            maxFiles: 5,
            colorize: false,
        })
    ]
});
