// debuggAiLogger.js
import pino from 'pino';

let loggerInstance = null;

class DebuggAiLogger {
  static async init(options = {}) {
    // If already initialized, just return the same logger
    if (loggerInstance) {
      return loggerInstance;
    }
    const loggerInstance = pino(
      {
        ...pinoOptions,
        level,
      },
    );
    return loggerInstance;
  }

  // Provide a getter if the user wants direct pino access
  getLogger() {
    if (!loggerInstance) {
      throw new Error('DebuggAiLogger not initialized. Call DebuggAiLogger.init(...) first.');
    }
    return loggerInstance;
  }

  // Or add convenience methods if you like:
  info(...args) {
    this.getLogger().info(...args);
  }
  error(...args) {
    this.getLogger().error(...args);
  }
  warn(...args) {
    this.getLogger().warn(...args);
  }
  debug(...args) {
    this.getLogger().debug(...args);
  }
}

export default DebuggAiLogger;
