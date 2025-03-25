// debuggAiLogger.js
import pino from 'pino';
import { interceptConsole } from './consoleInterceptor.js';
import createBrowserTransmit from '../transports/browserTransmit.js';
import { browserInterceptor } from './browserInterceptor.js';

// Simple dirname implementation that works in browser
const getDirname = (url) => {
  const parts = url.split('/');
  parts.pop(); // Remove the file name
  return parts.join('/');
};

const __filename = import.meta.url.replace('file://', '');
const __dirname = getDirname(__filename);
const __parentDir = getDirname(__dirname);

// console.log('__filename', __filename);
// console.log('__dirname', __dirname);
// console.log('__parentDir', __parentDir);

let loggerInstance = null;

class DebuggAiLogger {
  static async init(options = {}) {
    // If already initialized, just return the same logger
    if (loggerInstance) {
      return loggerInstance;
    }

    // Extract custom options
    const {
      level = 'info',
      endpoint,
      includeConsole = true,
      pinoOptions = {}, // user can pass extra pino config
    } = options;

    // Check if we're in a browser environment
    const isBrowser = typeof window !== 'undefined';

    // Create pino instance with different configurations for browser and Node.js
    if (isBrowser) {
      // Use the helper to create our "transmit" config
      const transmit = createBrowserTransmit(endpoint, level);

      // Browser configuration - simpler setup without transport
      loggerInstance = pino({
        ...pinoOptions,
        level,
        browser: {
          transmit,
          write: (o) => {
            // You might want to implement custom handling here
            // For now, we'll just use console methods
            const level = o.level;
            const msg = o.msg;

            if (o._fromPino) {
              return;
            }

            switch (level) {
              case 30: console.info({ ...o, _fromPino: true }, msg); break;  // info
              case 40: console.warn({ ...o, _fromPino: true }, msg); break;  // warn
              case 50: console.error({ ...o, _fromPino: true }, msg); break; // error
              default: console.log({ ...o, _fromPino: true }, msg);          // debug/trace
            }
          }
        }
      });

      if (includeConsole) {
        browserInterceptor(loggerInstance);
      }
    } else {
      // Node.js configuration - use transport
      const transport = pino.transport({
        target: `${__parentDir}/transports/debuggAiTransport.js`,
        options: { endpoint, level }
      });

      loggerInstance = pino(
        {
          ...pinoOptions,
          level,
        },
        transport
      );
      if (includeConsole) {
        interceptConsole(loggerInstance);
      }

    }

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
