
// Use dynamic imports for environment-specific modules
async function loadModules() {
    if (typeof window === 'undefined') {
        // Node.js environment
        const { interceptConsole } = await import('./consoleInterceptor.js');
        const { debuggAiTransport } = await import('../transports/debuggAiTransport.js');
        return { interceptConsole, debuggAiTransport };
    } else {
        // Browser environment
        return { interceptConsole: () => { } };
    }
}

// Simple dirname implementation that works in browser
const getDirname = (url) => {
    const parts = url.split('/');
    parts.pop(); // Remove the file name
    return parts.join('/');
};


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

    const modules = await loadModules();

    const __filename = import.meta.url.replace('file://', '');
    const __dirname = getDirname(__filename);
    const __parentDir = getDirname(__dirname);
    // Node.js configuration - use transport
    const transport = pino.transport({
        target: `${__parentDir}/transports/debuggAiTransport.js`,
        // target: modules.debuggAiTransport,
        options: { ...options, endpoint, hostName, level }
    });

    const loggerInstance = pino(
        {
            ...pinoOptions,
            level,
        },
        transport
    );
    if (includeConsole) {
        modules.interceptConsole(loggerInstance);
    }

    return loggerInstance;
}

export default initLogger;