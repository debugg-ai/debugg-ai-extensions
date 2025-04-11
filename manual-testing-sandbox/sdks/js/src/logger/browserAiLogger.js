// Use dynamic imports for environment-specific modules
import pino from 'pino';
import { createBrowserTransmit } from '../transports/browserTransmit.js';
import { browserInterceptor } from './browserInterceptor.js';
import DebuggAiLogger from './debuggAiLogger.js';


let loggerInstance = null;

const initLogger = async (options = {}) => {
    // Extract custom options
    const {
        pino,
        level = 'info',
        endpoint,
        hostName = '',
        environment = '',
        includeConsole = true,
        pinoOptions = {}, // user can pass extra pino config
    } = options;

    // Use the helper to create our "transmit" config
    const transmit = createBrowserTransmit(endpoint, hostName, environment, level);

    // Browser configuration - simpler setup without transport
    const loggerInstance = pino({
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
    return loggerInstance;
}

class BrowserAiLogger extends DebuggAiLogger {
    constructor(options = {}) {
        super(options);
    }

    static async init(options = {}) {
        return initLogger(options);
    }
    static async init(options = {}) {
      // If already initialized, just return the same logger
      if (loggerInstance) {
        return loggerInstance;
      }
      
      loggerInstance = await initLogger({pino, ...options});
  
      return loggerInstance;
    }
}

export default BrowserAiLogger;