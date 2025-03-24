// transports/HttpTransport.js
import { once } from 'events';

// This default export is what's run in the worker thread
export default async function (opts) {
  // `opts` are the transport options you pass from MyLogger.js
  const { endpoint } = opts;

  // concurrency can be handled with a queue or something more elaborate,
  // but here's a simple version that just sends logs in a loop.
  // If concurrency is large, you might spin up multiple fetches in parallel.

  // We must return an async function that receives log objects from the "source"
  return async function (source) {
    for await (const obj of source) {
      // Each `obj` is a log line from Pino, as a parsed JSON object
      // For example: { level: 30, time: 167303..., msg: "Hello", etc. }

      if (!endpoint) {
        // If no endpoint provided, just log to stdout or do nothing
        console.log('Transport output (no endpoint set):', obj);
        continue;
      }

      // Send the log to your endpoint
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(obj),
        });
      } catch (err) {
        // Handling fetch errors
        console.error('Transport failed to send log:', err, obj);
      }
    }

    // The source stream has ended
    await once(source, 'end');
  };
}
