// Map console levels to Sentinal levels
const CONSOLE_TO_SENTINAL = {
  log: 'info',
  info: 'info',
  warn: 'warn',
  error: 'error',
  debug: 'debug'
};

class ConsoleWrapper {
  constructor() {
    this.originalConsole = {};
    this.wrapped = false;
  }

  wrapConsole(sentinalLogger) {
    if (this.wrapped) return;

    // Store original console methods
    Object.keys(CONSOLE_TO_SENTINAL).forEach(method => {
      this.originalConsole[method] = console[method].bind(console);

      console[method] = (...args) => {
        // 1) Capture the stack trace
        const stackStr = getStackTrace();
        const { filePath, lineno, colno } = parseStackTrace(stackStr);

        // 2) Call original console method
        this.originalConsole[method](...args);

        // 3) Convert console arguments to a format Sentinal expects
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');

        // 4) Extract any object arguments as meta
        const meta = args.reduce((acc, arg) => {
          if (arg && typeof arg === 'object') {
            return { ...acc, ...arg };
          }
          return acc;
        }, {});

        // 5) Merge the stack info into meta
        meta.stack = stackStr;
        meta.filePath = filePath;
        meta.lineno = lineno;
        meta.colno = colno;

        // 6) Send to Sentinal logger
        const sentinalLevel = CONSOLE_TO_SENTINAL[method];
        sentinalLogger.log(sentinalLevel, message, meta);
      };
    });

    this.wrapped = true;
  }

  unwrapConsole() {
    if (!this.wrapped) return;

    Object.keys(this.originalConsole).forEach(method => {
      console[method] = this.originalConsole[method];
    });

    this.wrapped = false;
  }
}

// Implementation of `getStackTrace()` & `parseStackTrace()` from above
function getStackTrace() {
  const err = new Error();
  return err.stack || '';
}


// Simple parse that tries to get the second or third line 
// in the stack (depending on how many frames you skip)
function parseStackTrace(stackStr) {
  const lines = (stackStr || '').split('\n').map(line => line.trim());
  // lines[0] = "Error"
  // lines[1] = "at getStackTrace (<anonymous>:10:15)"
  // lines[2] = "at console.log (<anonymous>:20:11)" <-- may vary
  // You might want the next line after wrapping code, if it’s your user code

  // This is simplistic—improve or adjust as needed
  const callerLine = lines[2] || lines[1];
  const result = {};

  if (callerLine) {
    // e.g., "at console.log (<anonymous>:20:11)"
    const matches = callerLine.match(/\(([^)]+)\)/);
    if (matches && matches[1]) {
      const [filePath, lineno, colno] = matches[1].split(':');
      result.filePath = filePath;
      result.lineno = lineno;
      result.colno = colno;
    }
  }
  return result;
}

// Singleton instance
let instance = null;

export default {
  init(sentinalLogger) {
    if (!instance) {
      instance = new ConsoleWrapper();
    }
    instance.wrapConsole(sentinalLogger);
    return instance;
  },

  unwrap() {
    if (instance) {
      instance.unwrapConsole();
    }
  }
}; 