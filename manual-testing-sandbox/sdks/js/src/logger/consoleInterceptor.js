// consoleInterceptor.js
const originalConsole = { ...console };

export function interceptConsole(logger) {
  // Wrap the console methods you care about
  ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
    console[method] = (...args) => {
      // 1. Capture / parse the stack
      const stackStr = getStackTrace();
      const { filePath, lineno, colno, trimmedStack, funcName } = parseStackTrace(stackStr);

      // 2. Construct a message from the arguments
      const message = args
        .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      // 3. Build a metadata object that includes stack info
      const meta = {
        stack: trimmedStack,
        filePath,
        lineno,
        colno,
        funcName
      };

      // 4. Print to original console (so dev tools / terminal still see output)
      //    This ensures you don't lose your local console logs.
      originalConsole[method](...args);

      // 5. Log to pino. We pass `meta` as the first argument object,
      //    and `message` as the second argument so it appears nicely in Pino logs
      //    e.g. "level" keys become pino's level, etc.
      if (typeof logger[method] === 'function') {
        // pino’s built-in methods: .info, .error, .warn, etc.
        logger[method]({ meta }, message);
      } else {
        // fallback if pino doesn’t have a method for it:
        logger.info({ meta }, message);
      }
    };
  });
}

export function restoreConsole() {
  // Restore original console methods if needed
  Object.keys(originalConsole).forEach(method => {
    console[method] = originalConsole[method];
  });
}

/**
 * Captures the current stack trace using an Error object
 */
function getStackTrace() {
  const err = new Error();
  return err.stack || '';
}

/**
 * A simple parse that tries to grab the second or third line from the stack
 * Each browser/Node version can differ in formatting.
 */
function parseStackTrace(stackStr) {
  const result = {
    filePath: undefined,
    lineno: undefined,
    colno: undefined,
    trimmedStack: stackStr || ''
  };

  if (!stackStr) {
    // No stack? Return defaults
    return result;
  }

  // Split lines, trim whitespace
  const lines = stackStr.split('\n').map(line => line.trim());
  // lines[0] = "Error"
  // lines[1] = "at getStackTrace ( ... )"
  // lines[2] = "at console.log ( ... )"
  // lines[3] = The user call site, in some cases – though this can vary by environment.

  // Safely pick the "caller line" – attempt line[3], then fall back to [2], [1]
  const callerLine = lines[3] || lines[2] || lines[1] || '';


  // This regex looks for:
  //  1) Optional "("
  //  2) A path starting with "file:///" (capturing it up until a colon that leads to line/col)
  //  3) A colon + digits (line number)
  //  4) Another colon + digits (column number)
  //  5) Optional ")"
  //
  // Example match: "file:///Users/....js:52:9"
  const matches = callerLine.match(/\(?(file:\/\/\/[^:\s]+):(\d+):(\d+)\)?/);
   
  if (matches) {
    // matches[1] => "file:///Users/..../index.js"
    // matches[2] => "52"
    // matches[3] => "9"
    result.filePath = matches[1];
    result.lineno = matches[2];
    result.colno = matches[3];
  }

  // match the function name
  // format 'at newFunction (file:///Users/...:32:12)\n'
  // extract newFunction
  const functionMatches = callerLine.match(/^\s*at\s+([^(]+)\s*\(/);
  if (functionMatches) {
    result.funcName = functionMatches[1].trim();
  }

  // For trimmedStack, skip the first two lines: "Error" + "at getStackTrace(...)"
  // Adjust the slice index if you want to skip more or fewer lines
  result.trimmedStack = 'Error at \n' + lines.slice(3).join('\n');
  return result;
}

