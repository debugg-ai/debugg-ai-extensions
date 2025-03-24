// transports/debuggAiTransport.js
import build from 'pino-abstract-transport'
import { once } from 'events';
import { post } from '../utils/axiosNaming.js';
import { stackParser } from '../parsers/stackParser.js';

// Optional: map numeric Pino levels to string levels
const PINO_TO_STRING_LEVELS = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal'
};

// Optional: your legacy gating table
const LOG_LEVELS = {
  fatal: 0, // or same as error if you prefer
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Pino transport entry point.
 * Pino will run this in a worker thread by default when you configure it as a transport.
 *
 * @param {Object} opts - Transport options provided by your logger setup
 * @param {string} opts.endpoint - Where to POST logs
 * @param {string} [opts.level=info] - Minimum level at which to log
 * @returns {Function} async function that processes log records from Pino
 */
export default async function (opts) {
  const { endpoint, level = 'info' } = opts;

  // Basic safeguard if user passes something invalid
  const normalizedLevel = LOG_LEVELS.hasOwnProperty(level) ? level : 'info';

  return build(async function (source) {
    // For each log object from Pino:
    for await (const obj of source) {
      // obj typically includes { level, msg, time, pid, hostname, meta, etc. }
      // Convert the numeric Pino level to a textual level like 'info', 'warn', etc.
      const levelName = PINO_TO_STRING_LEVELS[obj.level] || 'info';

      // Check if we should skip based on your custom gating
      if (LOG_LEVELS[levelName] > LOG_LEVELS[normalizedLevel]) {
        continue; // skip sending
      }

      // Extract error information
    //   const { filePath, lineNo, funcName, stack } = stackParser(obj);

      console.log('obj', obj);
      // Build the payload that you want to send to the remote endpoint
      // The fields (stack_trace, filename, etc.) assume you attached them in obj.meta
      const payload = {
        host: obj.serviceName,
        message: obj.msg,
        level: levelName.toUpperCase(),
        loggerName: 'sentinal',
        stackTrace: obj.meta?.stack,
        filename: obj.meta?.filePath,
        filePath: obj.meta?.filePath,
        lineNumber: obj.meta?.lineno,
        columnNumber: obj.meta?.colno,
        funcName: obj.meta?.funcName,
        extraData: obj.meta,
        timestamp: new Date().toISOString()
      };
      console.log('payload', payload);
      // Send to your endpoint if provided; otherwise just log to console or do nothing
      if (endpoint) {
        try {
        //   await fetch(endpoint, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload)
        //   // });
          await post(endpoint, payload);

        } catch (err) {
          // For errors in the transport itself, you can:
          //  - swallow them
          //  - log them to console
          //  - or send them to a fallback
          console.log('Transport failed to send log:', err, payload);
        }
      } else {
        // If no endpoint is set, do something else (e.g. console or file)
        console.log('No endpoint set; logging data:', payload);
      }
    }
  });
}
