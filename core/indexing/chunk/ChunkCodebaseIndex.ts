/**
 * ChunkCodebaseIndex is a class that manages the indexing of code files by breaking them into smaller chunks
 * and storing them in a SQLite database. It implements the CodebaseIndex interface and provides functionality
 * for managing code chunks with associated tags.
 */
import * as path from "path";

import { RunResult } from "sqlite3";

import { Chunk, IndexTag, IndexingProgressUpdate } from "../../index.js";
import { getUriPathBasename } from "../../util/uri.js";
import { DatabaseConnection, SqliteDb, tagToString } from "../refreshIndex.js";
import {
  IndexResultType,
  MarkCompleteCallback,
  PathAndCacheKey,
  RefreshIndexResults,
  type CodebaseIndex,
} from "../types.js";

import { IDebuggAIServerClient } from "../../debuggAIServer/interface.js";
import { chunkDocument, shouldChunk } from "./chunk.js";

export class ChunkCodebaseIndex implements CodebaseIndex {
  // Relative expected time for indexing operations
  relativeExpectedTime: number = 1;
  // Unique identifier for this type of index
  static artifactId = "chunks";
  artifactId: string = ChunkCodebaseIndex.artifactId;

  /**
   * Creates a new instance of ChunkCodebaseIndex
   * @param readFile - Function to read file contents
   * @param debuggAIServerClient - Client for communicating with the DebuggAI server
   * @param maxChunkSize - Maximum size of each code chunk
   */
  constructor(
    private readonly readFile: (filepath: string) => Promise<string>,
    private readonly debuggAIServerClient: IDebuggAIServerClient,
    private readonly maxChunkSize: number,
  ) {}

  /**
   * Updates the codebase index with new chunks and tags.
   * This method handles:
   * 1. Checking remote cache for existing chunks
   * 2. Computing new chunks for files not in cache
   * 3. Adding/removing tags from chunks
   * 4. Deleting chunks when files are removed
   * 
   * @param tag - The tag to be associated with the chunks
   * @param results - Results of the refresh index operation
   * @param markComplete - Callback to mark items as complete
   * @param repoName - Optional repository name
   * @returns AsyncGenerator yielding progress updates during indexing
   */
  async *update(
    tag: IndexTag,
    results: RefreshIndexResults,
    markComplete: MarkCompleteCallback,
    repoName: string | undefined,
  ): AsyncGenerator<IndexingProgressUpdate, any, unknown> {
    // Get the database connection and create necessary tables
    const db = await SqliteDb.get();
    await this.createTables(db);
    const tagString = tagToString(tag);

    // Check the remote cache for existing chunks
    if (this.debuggAIServerClient.connected) {
      try {
        const keys = results.compute.map(({ cacheKey }) => cacheKey);
        const resp = await this.debuggAIServerClient.getFromIndexCache(
          keys,
          "chunks",
          repoName,
        );
    
        for (const [cacheKey, chunks] of Object.entries(resp.files)) {
          await this.insertChunks(db, tagString, chunks);
        }
    
        results.compute = results.compute.filter(
          (item) => !resp.files[item.cacheKey],
        );
      } catch (e) {
        console.error("Failed to fetch from remote cache: ", e);
      }
    }
    let accumulatedProgress = 0;

    // Process remaining items that need to be computed
    if (results.compute.length > 0) {
      const filepath = results.compute[0].path;
      const folderName = path.basename(path.dirname(filepath));

      // Yield progress update for chunking files
      yield {
        desc: `Chunking files in ${folderName}`,
        status: "indexing",
        progress: accumulatedProgress,
      };
      // Compute chunks for the remaining items
      const chunks = await this.computeChunks(results.compute);
      // Insert computed chunks into the database
      await this.insertChunks(db, tagString, chunks);
      // Mark the computed items as complete
      await markComplete(results.compute, IndexResultType.Compute);
    }

    // Add tag
    for (const item of results.addTag) {
      await db.run(
        `
        INSERT INTO chunk_tags (chunkId, tag)
        SELECT id, ? FROM chunks
        WHERE cacheKey = ?
          AND id NOT IN (
            SELECT chunkId FROM chunk_tags WHERE tag = ?
          )
        `,
        [tagString, item.cacheKey, tagString],
      );

      await markComplete([item], IndexResultType.AddTag);
      accumulatedProgress += 1 / results.addTag.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Adding ${getUriPathBasename(item.path)}`,
        status: "indexing",
      };
    }

    // Remove tag
    for (const item of results.removeTag) {
      await db.run(
        `
        DELETE FROM chunk_tags
        WHERE tag = ?
          AND chunkId IN (
            SELECT id FROM chunks
            WHERE cacheKey = ? AND path = ?
          )
      `,
        [tagString, item.cacheKey, item.path],
      );
      await markComplete([item], IndexResultType.RemoveTag);
      accumulatedProgress += 1 / results.removeTag.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getUriPathBasename(item.path)}`,
        status: "indexing",
      };
    }

    // Delete
    for (const item of results.del) {
      const chunkToDelete = await db.get(
        "SELECT id FROM chunks WHERE cacheKey = ?",
        [item.cacheKey],
      );

      if (chunkToDelete) {
        await db.run("DELETE FROM chunks WHERE id = ?", [chunkToDelete.id]);

        // Delete from chunk_tags
        await db.run("DELETE FROM chunk_tags WHERE chunkId = ?", [
          chunkToDelete.id,
        ]);
      } else {
        console.debug("Chunk to delete wasn't found in the table: ", item.path);
      }

      await markComplete([item], IndexResultType.Delete);
      accumulatedProgress += 1 / results.del.length / 4;
      yield {
        progress: accumulatedProgress,
        desc: `Removing ${getUriPathBasename(item.path)}`,
        status: "indexing",
      };
    }
  }

  /**
   * Creates the necessary database tables if they don't exist:
   * - chunks: Stores the actual code chunks with their metadata
   * - chunk_tags: Stores the association between chunks and tags
   * 
   * @param db - Database connection
   */
  private async createTables(db: DatabaseConnection) {
    await db.exec(`CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cacheKey TEXT NOT NULL,
      path TEXT NOT NULL,
      idx INTEGER NOT NULL,
      startLine INTEGER NOT NULL,
      endLine INTEGER NOT NULL,
      content TEXT NOT NULL
    )`);

    await db.exec(`CREATE TABLE IF NOT EXISTS chunk_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL,
        chunkId INTEGER NOT NULL,
        FOREIGN KEY (chunkId) REFERENCES chunks (id),
        UNIQUE (tag, chunkId)
    )`);
  }

  /**
   * Converts a single file into chunks based on its content
   * 
   * @param pack - Object containing file path and cache key
   * @returns Promise resolving to an array of Chunk objects
   */
  private async packToChunks(pack: PathAndCacheKey): Promise<Chunk[]> {
    const contents = await this.readFile(pack.path);
    if (!shouldChunk(pack.path, contents)) {
      return [];
    }
    const chunks: Chunk[] = [];
    const chunkParams = {
      filepath: pack.path,
      contents,
      maxChunkSize: this.maxChunkSize,
      digest: pack.cacheKey,
    };
    for await (const c of chunkDocument(chunkParams)) {
      chunks.push(c);
    }
    return chunks;
  }

  /**
   * Processes multiple files and converts them into chunks
   * 
   * @param paths - Array of file paths and cache keys to process
   * @returns Promise resolving to a flattened array of all chunks
   */
  private async computeChunks(paths: PathAndCacheKey[]): Promise<Chunk[]> {
    const chunkLists = await Promise.all(
      paths.map((p) => this.packToChunks(p)),
    );
    return chunkLists.flat();
  }

  /**
   * Inserts chunks into the database and associates them with tags
   * Uses a transaction to ensure data consistency
   * 
   * @param db - Database connection
   * @param tagString - Tag to associate with the chunks
   * @param chunks - Array of chunks to insert
   */
  private async insertChunks(
    db: DatabaseConnection,
    tagString: string,
    chunks: Chunk[],
  ) {
    await new Promise<void>((resolve, reject) => {
      db.db.serialize(() => {
        db.db.exec("BEGIN", (err: Error | null) => {
          if (err) {
            reject(new Error("error creating transaction", { cause: err }));
          }
        });
        const chunksSQL =
          "INSERT INTO chunks (cacheKey, path, idx, startLine, endLine, content) VALUES (?, ?, ?, ?, ?, ?)";
        chunks.map((c) => {
          db.db.run(
            chunksSQL,
            [c.digest, c.filepath, c.index, c.startLine, c.endLine, c.content],
            (result: RunResult, err: Error) => {
              if (err) {
                reject(
                  new Error("error inserting into chunks table", {
                    cause: err,
                  }),
                );
              }
            },
          );
          const chunkTagsSQL =
            "INSERT INTO chunk_tags (chunkId, tag) VALUES (last_insert_rowid(), ?)";
          db.db.run(
            chunkTagsSQL,
            [tagString],
            (result: RunResult, err: Error) => {
              if (err) {
                reject(
                  new Error("error inserting into chunk_tags table", {
                    cause: err,
                  }),
                );
              }
            },
          );
        });
        db.db.exec("COMMIT", (err: Error | null) => {
          if (err) {
            reject(
              new Error("error while committing insert chunks transaction", {
                cause: err,
              }),
            );
          } else {
            resolve();
          }
        });
      });
    });
  }
}
