import { NullableMappedPosition, RawSourceMap, SourceMapConsumer } from 'source-map';
import { parseStackTrace, StackTraceLine } from './stackParser.ts';

/**
 * Example stack trace referencing multiple minified files.
 */
const stackTrace = `
Error: Something went wrong!
    at doSomething (bundleA.js:1000:20)
    at main (bundleB.js:2000:15)
    at somethingElse (bundleA.js:1500:25)
`;

/**
 * Convert a minified filename (like "bundleA.js") to a publicly accessible
 * URL for the source map (like "https://example.com/bundleA.js.map").
 *
 * In a real scenario, you might:
 *  - Use a known CDN prefix
 *  - Dynamically build the URL
 *  - Use a dictionary of known file->map URLs
 */
const mapFileUrlFromMinifiedFile = (rootDomain: string | null, minifiedFile: string): string => {
  // e.g. put them all in a /maps/ folder on your server:
  if (!rootDomain) {
    return `${minifiedFile}.map`;
  }
  return `${rootDomain}/maps/${minifiedFile}.map`;
}

/**
 * We'll keep a cache of SourceMapConsumers so each .map is loaded only once.
 */
const consumerCache: Record<string, SourceMapConsumer> = {};

/**
 * Loads (or retrieves from cache) the SourceMapConsumer for the given minified file name
 * by fetching the .map file over HTTP instead of reading from disk.
 */
const getSourceMapConsumer = async (rootDomain: string | null, minifiedFile: string): Promise<SourceMapConsumer | null> => {
  // If we've already created a consumer, return it
  if (consumerCache[minifiedFile]) {
    return consumerCache[minifiedFile];
  }

  // Otherwise, build the URL to fetch
  const mapUrl = mapFileUrlFromMinifiedFile(rootDomain, minifiedFile);
  try {
    const response = await fetch(mapUrl);
    if (!response.ok) {
      console.warn(`Map file not found or error fetching ${mapUrl}`);
      return null;
    }

    // Parse the JSON from the fetch
    const rawMapData = await response.text();
    const rawSourceMap: RawSourceMap = JSON.parse(rawMapData);

    // Create the SourceMapConsumer
    const consumer = await new SourceMapConsumer(rawSourceMap);
    consumerCache[minifiedFile] = consumer;
    return consumer;
  } catch (err) {
    console.warn(`Failed to fetch source map from ${mapUrl}`, err);
    return null;
  }
}

/**
 * Structure for the returned result of a deminify call.
 */
export interface DeminifiedStack {
  originalStack: string;
  parsedOriginalStack: StackTraceLine[];
  deminifiedStack: string | null;
  parsedDeminifiedStack: StackTraceLine[];
}

/**
 * Main function to deminify the entire stack trace in a browser-friendly way.
 */
export async function deminifyStack(stack: string, rootDomain: string | null): Promise<DeminifiedStack> {
  // 1) Parse the stack trace lines
  const parsedLines = parseStackTrace(stack);
  const parsedDeminifiedStack: StackTraceLine[] = [];

  console.log('Parsed lines:', parsedLines);
  // 2) For each line that has file/line/col, find the original position
  for (const parsedLine of parsedLines) {
    if (parsedLine.file && parsedLine.line && parsedLine.column) {
      // Grab the matching SourceMapConsumer
      const consumer = await getSourceMapConsumer(rootDomain, parsedLine.file);
      if (!consumer) {
        console.log(`\n[No Source Map] Parsed file - ${parsedLine.file}`);
        parsedDeminifiedStack.push(parsedLine);
        continue;
      }

      // Look up the original position
      const originalPos: NullableMappedPosition = consumer.originalPositionFor({
        line: parsedLine.line,
        column: parsedLine.column,
      });

      console.log('\nMinified:', parsedLine.original.trim());
      console.log('Deminified:', originalPos);

      // Update the parsedLine to reflect the original location
      if (originalPos.source) {
        parsedLine.file = originalPos.source;
      }
      if (originalPos.line) {
        parsedLine.line = originalPos.line;
      }
      if (originalPos.column) {
        parsedLine.column = originalPos.column;
      }
      if (originalPos.name) {
        parsedLine.functionName = originalPos.name;
      }

      parsedDeminifiedStack.push(parsedLine);
    } else {
      // For lines that don't match our pattern
      console.log('\nUnparseable line:', parsedLine.original.trim());
      parsedDeminifiedStack.push(parsedLine);
    }
  }

  // Optional: destroy all consumers if you want to free memory
  Object.values(consumerCache).forEach((c) => c.destroy());

  return {
    originalStack: stack,
    parsedOriginalStack: parsedLines,
    deminifiedStack: parsedDeminifiedStack
      .map((line) => line.original)
      .join('\n'),
    parsedDeminifiedStack,
  };
}

// Example usage (uncomment in your real code):
// (async () => {
//   const result = await deminifyStack(stackTrace);
//   console.log('Deminify result:', result);
// })();
