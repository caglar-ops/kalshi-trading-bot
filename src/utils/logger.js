const fs = require('fs');
const path = require('path');

class Logger {
  constructor(module) {
    this.module = module;
    this.logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Get log file path for today
   */
  getLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `kalshi-bot-${date}.log`);
  }

  /**
   * Write to log file
   */
  write(message) {
    try {
      const logFile = this.getLogFile();
      const timestamp = new Date().toISOString();
      const entry = `[${timestamp}] ${message}\n`;

      fs.appendFileSync(logFile, entry);
    } catch (error) {
      console.error('Failed to write to log:', error);
    }
  }

  /**
   * Log info message
   */
  info(message) {
    const msg = `[${this.module}] INFO: ${message}`;
    console.log(msg);
    this.write(msg);
  }

  /**
   * Log error message
   */
  error(message, error) {
    const details = error ? `\n${error.stack || error}` : '';
    const msg = `[${this.module}] ERROR: ${message}${details}`;
    console.error(msg);
    this.write(msg);
  }

  /**
   * Log warning message
   */
  warn(message) {
    const msg = `[${this.module}] WARN: ${message}`;
    console.warn(msg);
    this.write(msg);
  }

  /**
   * Log debug message (only if LOG_LEVEL=debug)
   */
  debug(message) {
    if (this.logLevel === 'debug') {
      const msg = `[${this.module}] DEBUG: ${message}`;
      console.log(msg);
      this.write(msg);
    }
  }
}

module.exports = Logger;
