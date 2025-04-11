export interface StackTraceLine {
  original: string;
  functionName?: string;
  file?: string;
  line?: number;
  column?: number;
}

// Helper function to parse stack trace line
export function parseStackTraceLine(line: string): StackTraceLine | null {
    // Match patterns like: "at functionName (file.js:line:column)"
    const regex = new RegExp('at\\s+(?:(.+?)\\s+\\$)?(?:(.+?):(\\d+):(\\d+))\\$?');
    const match = line.match(regex);
    
    if (!match) return null;
    
    const [, functionName, file, lineStr, columnStr] = match;
    return {
      original: line,
      functionName: functionName || 'anonymous',
      file,
      line: parseInt(lineStr, 10),
      column: parseInt(columnStr, 10)
    };
}
  
// Parse a full stack trace into lines
export function parseStackTrace(stackTrace: string): StackTraceLine[] {
    const lines = stackTrace.split('\n');
    const parsedLines: StackTraceLine[] = [];
    
    for (const line of lines) {
      const parsedLine = parseStackTraceLine(line.trim());
      
      if (parsedLine) {
        parsedLines.push(parsedLine);
      } else {
        // Keep unparseable lines as-is
        parsedLines.push({ original: line });
      }
    }
    
    return parsedLines;
}