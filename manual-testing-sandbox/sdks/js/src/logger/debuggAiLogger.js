// debuggAiLogger.js
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import { interceptConsole } from './consoleInterceptor.js';
import debuggAiTransport from '../transports/debuggAiTransport.js';
// Helper to get an absolute path to your transport file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __parentDir = path.dirname(__dirname);

console.log('__filename', __filename);
console.log('__dirname', __dirname);
console.log('__parentDir', __parentDir);

let loggerInstance = null;


const DebuggAiLogger = {
  init(options = {}) {
    // If already initialized, just return the same logger
    if (loggerInstance) {
      return loggerInstance;
    }

    // Extract custom options
    const {
      level = 'info',
      endpoint,
      // concurrency, etc. if you want them
      includeConsole = true,
      pinoOptions = {}, // user can pass extra pino config
    } = options;

    // Pino transport config
    // `target` is the path to our custom transport file
    // `options` are passed to the default export from HttpTransport
    const transport = pino.transport({
      target: path.join(__parentDir, 'transports/debuggAiTransport.js'),
    //   target: debuggAiTransport,
      options: { endpoint, level }
      // If concurrency is needed, you might do:
      // options: { endpoint, concurrency: 5, ...etc }
    });

    // Create pino instance
    // Merged user-provided pinoOptions with our forced-level config
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

    return loggerInstance;
  },

  // Provide a getter if the user wants direct pino access
  getLogger() {
    if (!loggerInstance) {
      throw new Error('DebuggAiLogger not initialized. Call DebuggAiLogger.init(...) first.');
    }
    return loggerInstance;
  },

  // Or add convenience methods if you like:
  info(...args) {
    this.getLogger().info(...args);
  },
  error(...args) {
    this.getLogger().error(...args);
  },
  warn(...args) {
    this.getLogger().warn(...args);
  },
  debug(...args) {
    this.getLogger().debug(...args);
  },
};

export default DebuggAiLogger;
