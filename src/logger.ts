const winston = require("winston");

// list of logging levels in order
export const logLevels = ["error", "warn", "info", "verbose", "debug", "silly"];

// setup winston logger
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
    winston.format.timestamp(),
    winston.format.printf(info => `[${new Date(info.timestamp).toLocaleDateString("en-GB", printOptions)}] [${info.level.toUpperCase()}]: ${info.message}`)
);

export const logger = winston.createLogger({
    format: logFormat,
    transports: [
        new winston.transports.File({
            level: "info",
            filename: `${__dirname}/raptor.log`,
            handleExceptions: true,
            json: false,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            colorize: true,
        })
    ]
});
