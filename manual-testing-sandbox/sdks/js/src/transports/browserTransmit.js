// browserTransmit.js
import { deminifyStack } from '../parsers/deminifyBrowser';
import { post } from '../utils/axiosNaming';

/**
 * Creates a "transmit" configuration object for Pino's browser option.
 * This allows sending log events to the specified endpoint.
 * 
 * @param {string} endpoint - The URL to send logs to.
 * @param {string} hostName - The name of the host sending the logs.
 * @param {string} level - The minimum log level (e.g., 'info').
 * @returns {object} The transmit config for Pino's browser option.
 */
export function createBrowserTransmit(endpoint, hostName, environment, level = 'info') {
    return {
        // Tells Pino which log levels are sent to 'send'
        level,
        // Called for each log event that meets or exceeds the above level
        async send(logLevel, logEvent) {
            // logEvent typically looks like:
            // {
            //   ts: 1691836123456,  // timestamp
            //   messages: ["Hello world", { some: "data" }], 
            //   level: 30,         // numeric pino level
            //   ...
            // }
            try {
                if (!endpoint) return;

                // logEvent.messages is e.g. [ { stack: "..." }, "Hello" ]
                const [maybeMeta, ...rest] = logEvent.messages;
                let mainMessage = '';
                let meta = {};

                // If the first item is an object, treat it as metadata
                if (typeof maybeMeta === 'object' && maybeMeta !== null) {
                    meta = maybeMeta;
                    // Next item might be the actual string message
                    mainMessage = rest.shift() ?? '';
                } else {
                    // Otherwise the first item might be the message
                    mainMessage = maybeMeta;
                }
                const deminifiedStack = await deminifyStack(meta.stack, null);
                const stackTrace = deminifiedStack.deminifiedStack ?? meta.stack;

                // The rest of the array might be more arguments
                const extraArgs = rest;

                const payload = {
                    host: hostName,  //
                    environment: environment,
                    message: String(mainMessage),
                    level: logLevel.toUpperCase(),
                    loggerName: logEvent.bindings?.name || 'browser',
                    stackTrace: stackTrace,
                    filename: meta.filePath,
                    filePath: meta.filePath,
                    lineNumber: meta.lineno,
                    columnNumber: meta.colno,
                    funcName: meta.funcName,
                    extraData: extraArgs // leftover items
                };

                post(endpoint, payload);
            } catch (err) {
                // NEVER throw an error from a transport
            }
        }
    }
};

export default createBrowserTransmit;