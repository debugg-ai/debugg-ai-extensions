interface StackInfo {
    filePath?: string;
    lineNo?: number;
    funcName?: string;
    stack?: string;
}

// interface ErrorWithStack extends Error {
//   stack: string;
// }

export function stackParser(obj: { err?: Error }): StackInfo {
    let filePath: string | undefined;
    let lineNo: number | undefined;
    let funcName: string | undefined;
    let stack: string | undefined;
    let error: Error;

    // Check if there's an error object
    if (obj.err) {
        error = obj.err;

        stack = error.stack;
        // Parse the first line of the stack trace that contains file info
        const stackLines = (stack || '').split('\n');
        const fileLine = stackLines.find(line => line.includes('at '));
        if (fileLine) {
            // Extract file path and line number from stack trace
            const match = fileLine.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?/);
            if (match) {
                funcName = match[1];
                filePath = match[2];
                lineNo = parseInt(match[3], 10);
            }
        }
    }
    // If no error object, try to get caller info
    if (!filePath && Error.captureStackTrace) {
        const err: { stack?: string } = {};
        Error.captureStackTrace(err, stackParser);
        const stackLines = err.stack?.split('\n') || [];
        // Look for the first line that's not from this file
        const fileLine = stackLines.find(line =>
            line.includes('at ') && !line.includes('debuggAiTransport.js')
        );
        if (fileLine) {
            const match = fileLine.match(/at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+))\)?/);
            if (match) {
                funcName = match[1];
                filePath = match[2];
                lineNo = parseInt(match[3], 10);
            }
        }
    }

    return { filePath, lineNo, funcName, stack };
}