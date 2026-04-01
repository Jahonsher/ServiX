const config = require("../config");

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = config.nodeEnv === "production" ? LOG_LEVELS.info : LOG_LEVELS.debug;

function timestamp() {
  return new Date().toISOString();
}

function formatMessage(level, ...args) {
  const msg = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");
  return `[${timestamp()}] [${level.toUpperCase()}] ${msg}`;
}

const logger = {
  error(...args) {
    if (CURRENT_LEVEL >= LOG_LEVELS.error) {
      console.error(formatMessage("error", ...args));
    }
  },

  warn(...args) {
    if (CURRENT_LEVEL >= LOG_LEVELS.warn) {
      console.warn(formatMessage("warn", ...args));
    }
  },

  info(...args) {
    if (CURRENT_LEVEL >= LOG_LEVELS.info) {
      console.log(formatMessage("info", ...args));
    }
  },

  debug(...args) {
    if (CURRENT_LEVEL >= LOG_LEVELS.debug) {
      console.log(formatMessage("debug", ...args));
    }
  },
};

module.exports = logger;