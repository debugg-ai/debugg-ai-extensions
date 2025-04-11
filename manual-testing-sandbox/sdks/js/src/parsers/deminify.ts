// import * as fs from 'fs';
// import * as path from 'path';
import { NullableMappedPosition, SourceMapConsumer } from 'source-map';
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
 * For simplicity, let's assume our local map files are named like:
 *   bundleA.js.map
 *   bundleB.js.map
 *
 * We'll define a mapping from minified file -> map file path
 */
const mapFilePathFromMinifiedFile = (currentDir: string | undefined, minifiedFile: string): string => {
  if (!currentDir) {
    return `${minifiedFile}.map`;
  }
  return `${currentDir}/${minifiedFile}.map`;
};

/**
 * We'll keep a cache of SourceMapConsumers so we only load each .map once.
 */
const consumerCache: Record<string, SourceMapConsumer> = {};

/**
 * Loads (or retrieves from cache) the SourceMapConsumer for the given minified file name.
 */
async function getSourceMapConsumer(minifiedFile: string, currentDir: string): Promise<SourceMapConsumer | null> {
  // If we don't have a known map path for this file, return null
  if (!mapFilePathFromMinifiedFile(currentDir, minifiedFile)) {
    return null;
  }

  // If we've already created a consumer, return it
  if (consumerCache[minifiedFile]) {
    return consumerCache[minifiedFile];
  }

  // Otherwise, load the .map file from disk (or from network, if you prefer)
  const mapFilePath = mapFilePathFromMinifiedFile(currentDir, minifiedFile);
  // const fs = require('fs');
  // if (!fs.existsSync(mapFilePath)) {
  //   console.warn(`Map file not found for ${minifiedFile} at ${mapFilePath}`);
  //   return null;
  // }

  // const rawMapData = fs.readFileSync(mapFilePath, 'utf8');
  // const rawSourceMap: RawSourceMap = JSON.parse(rawMapData);
  const rawSourceMap = {
    version: 3,
    file: 'bundleA.js',
    sources: ['bundleA.js', 'bundleB.js'],
    names: ['doSomething', 'main', 'somethingElse'],
    mappings: 'A,AAAB;A,AAAC',
  };
  const consumer = await new SourceMapConsumer(rawSourceMap);
  consumerCache[minifiedFile] = consumer;
  return consumer;
}

export interface DeminifiedStack {
  originalStack: string;
  parsedOriginalStack: StackTraceLine[];
  deminifiedStack: string;
  parsedDeminifiedStack: StackTraceLine[];
}

/**
 * Main function to deminify the entire stack trace.
 */
export async function deminifyStack(stack: string, currentDir: string): Promise<DeminifiedStack> {
  // 1) Parse the stack trace lines
  const parsedLines = parseStackTrace(stack);
  const parsedDeminifiedStack: StackTraceLine[] = [];

  // 2) For each line that has file/line/col, find the original position
  for (const parsedLine of parsedLines) {
    const entry = parsedLine;
    if (entry.file && entry.line && entry.column) {
      // Grab the matching SourceMapConsumer
      const consumer = await getSourceMapConsumer(entry.file, currentDir);
      if (!consumer) {
        console.log(`\n[No Source Map] ${entry.original.trim()}`);
        continue;
      }

      // Look up the original position
      const originalPos: NullableMappedPosition = consumer.originalPositionFor({
        line: entry.line,
        column: entry.column,
      });

      console.log('\nMinified:', entry.original.trim());
      console.log('Deminified:', originalPos);
      entry.file = originalPos.source;
      entry.line = originalPos.line;
      entry.column = originalPos.column;
      entry.functionName = originalPos.name;

      parsedDeminifiedStack.push(entry);
    } else {
      // For lines that don't match our pattern
      console.log('\nUnparseable line:', entry.original.trim());
    }
  }

  // Optionally destroy consumers if you want to free memory
  // and/or do it at the end. E.g.:
  Object.values(consumerCache).forEach((c) => c.destroy());
  return {
    originalStack: stack,
    parsedOriginalStack: parsedLines,
    deminifiedStack: parsedDeminifiedStack ? parsedDeminifiedStack.map((line) => line.original).join('\n') : '',
    parsedDeminifiedStack: parsedDeminifiedStack,
  };
}

export function deminify(input: string): string {
    return input || ''; // Simple implementation for now
}
