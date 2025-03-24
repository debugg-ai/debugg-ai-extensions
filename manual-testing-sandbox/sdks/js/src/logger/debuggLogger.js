// DebuggLogger.js
import pino from 'pino';
// import ConsoleLogger from '../logger/consoleLogger'; // Assuming you have a separate console logger

// Map your textual levels to numeric ordering if you want to preserve them
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

class DebuggLogger {
  constructor(options = {}) {
    this.endpoint = options.endpoint;
    this.level = options.level || 'info';
    this.console = options.console !== false; // default: true

    // Create an instance of Pino at your specified minimum log level
    // Any logs below this level won't be logged by Pino at all
    this.pinoLogger = pino({
      level: this.level
      // Optionally configure pino’s transport or prettyPrint here
      // e.g. transport: { target: 'pino-pretty' }
    });
  }

  /**
   * Legacy gating: if you still want to check custom numeric levels
   * before calling pino, we can do so. But note that pino already
   * filters out logs below its configured level.
   */
  shouldLog(level) {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  async log(level, message, meta = {}) {
    // If the level is below the threshold, just ignore
    if (!this.shouldLog(level)) return;

    // This is what you'll send to the remote endpoint
    const payload = {
      message,
      level: level.toUpperCase(),
      logger_name: 'sentinal',
      stack_trace: meta.stack,
      filename: meta.filePath,
      file_path: meta.filePath,
      lineno: meta.lineno,
      funcName: meta.funcName, // if you parse it
      extra_data: meta,
      timestamp: new Date().toISOString()
    };

    // 1) Local logging via Pino
    // Pino expects objects and/or a message string. We'll pass our `meta` as an object:
    //   - The second argument to pinoLogger[level] is appended as the log message.
    //   - If you prefer, pass the entire payload as the first argument, but that might
    //     lead to duplication. Below, we pass meta separately and the message as the last arg.
    // if (this.console) {
    //   // Here we're either using a separate "ConsoleLogger" or you could just rely on Pino’s console
    //   // If you want to see logs in the terminal, you can rely on pino or keep this custom approach:
    //   const consoleLogger = ConsoleLogger.getLogger();
    //   consoleLogger.log(level, message, meta);
    // }

    // Use Pino’s logger too, which will print to stdout by default:
    this.pinoLogger[level]({ meta }, message);

    // 2) Remote logging
    // You can asynchronously fire this off using fetch to your endpoint
    if (this.endpoint) {
      try {
        fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {
          // Swallow or handle fetch errors as needed
        });
      } catch (err) {
        // If fetch itself fails, do something here if desired
      }
    }
  }

  // Convenience methods that map to your log() method
  error(message, meta) { return this.log('error', message, meta); }
  warn(message, meta)  { return this.log('warn',  message, meta); }
  info(message, meta)  { return this.log('info',  message, meta); }
  debug(message, meta) { return this.log('debug', message, meta); }
}

// Singleton instance
let instance = null;

export default {
  init(options = {}) {
    instance = new DebuggLogger(options);
    return instance;
  },

  getLogger() {
    if (!instance) {
      throw new Error("DebuggLogger not initialized. Call DebuggLogger.init(...) first.");
    }
    return instance;
  }
};
