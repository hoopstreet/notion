import fs from 'fs';
import path from 'path';

const LOG_DIR = './logs';

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logFile = path.join(LOG_DIR, 'backup.log');

function formatMessage(level, message) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
}

export const logger = {
  info: (msg) => {
    const formatted = formatMessage('info', msg);
    console.log(`\x1b[32m%s\x1b[0m`, formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  },
  warn: (msg) => {
    const formatted = formatMessage('warn', msg);
    console.warn(`\x1b[33m%s\x1b[0m`, formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  },
  error: (msg, errorObj = null) => {
    let formatted = formatMessage('error', msg);
    if (errorObj && errorObj.stack) {
      formatted += `\n${errorObj.stack}`;
    } else if (errorObj) {
      formatted += `\n${JSON.stringify(errorObj)}`;
    }
    console.error(`\x1b[31m%s\x1b[0m`, formatted);
    fs.appendFileSync(logFile, formatted + '\n');
  }
};
