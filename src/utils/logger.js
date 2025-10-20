const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);

const getTimestamp = () => new Date().toISOString();

const writeLog = (level, message, meta = {}) => {
  const logEntry = {
    timestamp: getTimestamp(),
    level,
    message,
    ...meta,
  };

  const logString = JSON.stringify(logEntry) + '\n';
  
  // Write to file
  fs.appendFileSync(logFile, logString);
  
  // Write to console with colors
  const colors = {
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    success: '\x1b[32m',
    reset: '\x1b[0m',
  };
  
  console.log(`${colors[level] || colors.reset}[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
};

const logger = {
  info: (message, meta) => writeLog('info', message, meta),
  warn: (message, meta) => writeLog('warn', message, meta),
  error: (message, meta) => writeLog('error', message, meta),
  success: (message, meta) => writeLog('success', message, meta),
};

module.exports = logger;
