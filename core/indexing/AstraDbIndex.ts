/*
 * AstraDbIndex – drop‑in replacement for LanceDbIndex that persists vectors in DataStax Astra DB.
 * ---------------------------------------------------------------------------------------------
 *  ‣ Uses the official `@datastax/astra-db-ts` Data API client (Node ≥ 18).
 *  ‣ Keeps the same public surface as the original `LanceDbIndex` so the surrounding
 *    codebase does not need to change (implements `CodebaseIndex`).
 *  ‣ Retains the local SQLite cache so that previously‑computed embeddings are reused
 *    exactly as before – only the vector store layer is swapped.
 *  ‣ One collection is created per branch/tag (`tableNameForTag()`), mirroring the
 *    table‑per‑tag approach in the Lance implementation.  Collections are created
 *    lazily with the correct vector dimension/metric the first time they are needed.
 *
 * Quick‑start
 * -----------
 * ```ts
 * import { AstraDbIndex } from "./astraDbIndex";
 * const index = await AstraDbIndex.create(embeddingsProvider, readFile, {
 *   apikey: process.env.ASTRA_DB_TOKEN!,           // App‑token generated in the portal
 *   endpoint: process.env.ASTRA_DB_ENDPOINT!,     // e.g. "https://<id>-<region>.apps.astra.datastax.com"
 *   keyspace: process.env.ASTRA_DB_KEYSPACE ?? "default_keyspace",
 *   metric: "cosine",                             // Optional – defaults to cosine
 * });
 * ```
 *
 * ---------------------------------------------------------------------------*/

import { createHash } from "crypto";

import {
    Collection,
    DataAPIClient,
} from "@datastax/astra-db-ts";
import { v4 as uuidv4 } from "uuid";

import { IDebuggAIServerClient } from "../debuggAIServer/interface";
import { VectorDatabaseIndexOpts } from "../index.d";
import { migrate } from "../util/paths"; // <‑ still used for sqlite path
import { getUriPathBasename } from "../util/uri";

import { basicChunker } from "./chunk/basic.js";
import { chunkDocument, shouldChunk } from "./chunk/chunk.js";
import {
    DatabaseConnection,
    SqliteDb,
    tagToString,
} from "./refreshIndex.js";
import {
    CodebaseIndex,
    IndexResultType,
    MarkCompleteCallback,
    PathAndCacheKey,
    RefreshIndexResults
} from "./types";

import type {
    BranchAndDir,
    Chunk,
    ILLM,
    IndexTag,
    IndexingProgressUpdate,
} from "../index";

// ---------------------------------------------------------------------------------------------
// Utility types & helpers
// ---------------------------------------------------------------------------------------------

/** Shape of a document stored in Astra. `$vector` is injected by VectorDoc. */
interface AstraRow {
    uuid: string;
    path: string;
    cachekey: string;
    startLine: number;
    endLine: number;
    contents: string;
    metadata: {
        filePath: string | undefined;
        absPath: string | undefined;
        relativePath: string | undefined;
        startLine: number | undefined;
        endLine: number | undefined;
        fileExtension: string | undefined;
    };
    $vector: number[];  // Simple number array instead of DataAPIVector
}

type ItemWithChunks = { item: PathAndCacheKey; chunks: Chunk[] };

type ChunkMap = Map<string, ItemWithChunks>;

interface AstraIndexOpts extends VectorDatabaseIndexOpts { }

// ---------------------------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------------------------

export class AstraDbIndex implements CodebaseIndex {
    private static clientCache: DataAPIClient | null = null;
    private static dbCache: ReturnType<DataAPIClient["db"]> | null = null;
    private static debuggAIServerClient: IDebuggAIServerClient | null = null;

    private readonly opts: Required<AstraIndexOpts>;

    relativeExpectedTime: number = 13; // same heuristic as before

    constructor(
        private readonly embeddingsProvider: ILLM,
        private readonly readFile: (filepath: string) => Promise<string>,
        opts: AstraIndexOpts,
        private readonly debuggAIServerClient?: IDebuggAIServerClient,
    ) {
        this.opts = {
            keyspace: opts.keyspace ?? "default_keyspace",
            metric: opts.metric ?? "cosine",
            ...opts,
        } as Required<AstraIndexOpts>;
    }

    /* --------------------------------------------------------------------------
     * Creation helpers (singleton‑ish db connection)
     * ------------------------------------------------------------------------*/
    private get db() {
        if (!AstraDbIndex.clientCache) {
            AstraDbIndex.clientCache = new DataAPIClient(this.opts.apiKey, {
                dbOptions: { keyspace: this.opts.keyspace }
            });
        }
        if (!AstraDbIndex.dbCache) {
            AstraDbIndex.dbCache = AstraDbIndex.clientCache.db(this.opts.endpoint, {
                keyspace: this.opts.keyspace,
            });
        }
        return AstraDbIndex.dbCache;
    }

    /** Unique identifier used by surrounding infra to detect incompatible artefacts */
    get artifactId(): string {
        return `astradb::${this.embeddingsProvider?.embeddingId}`;
    }

    /** Factory – mirrors LanceDbIndex.create signature for drop‑in replacement */
    static async create(
        embeddingsProvider: ILLM,
        readFile: (filepath: string) => Promise<string>,
        opts: AstraIndexOpts,
        debuggAIServerClient?: IDebuggAIServerClient,
    ): Promise<AstraDbIndex> {
        if (!opts?.apiKey || !opts?.endpoint) {
            throw new Error(
                "AstraDbIndex.create: `apiKey` and `endpoint` are required in opts – see documentation.",
            );
        }
        return new AstraDbIndex(embeddingsProvider, readFile, opts, debuggAIServerClient);
    }

    /* --------------------------------------------------------------------------
     * Private helpers (chunking / embedding identical to original)
     * ------------------------------------------------------------------------*/

    /**
     * Map an IndexTag → valid Astra collection name.
     * Rules (Astra 2025‑04):
     *   • 1‑48 chars, alphanumeric or underscore
     *   • must start with a letter
     * To preserve functional parity we deterministically hash long/invalid names.
    */
    private async tableNameForTag(tag: IndexTag) {
        const raw = tagToString(tag);
        // 1) replace illegal chars with underscore
        let name = raw.replace('file:///', '').replace(/[^A-Za-z0-9_]/g, "_");

        // Make sure we also update the remote server with the new index
        let userId: string | undefined = undefined;
        if (this.debuggAIServerClient) {
            userId = await this.debuggAIServerClient.getUserId();
        }

        // Combine user id with raw tag name
        let combinedName = raw;
        if (userId) {
            combinedName = `${userId}_${raw}`;
        }

        // Hash the combined name
        const hashId = createHash("sha1").update(combinedName).digest("hex").slice(0, 8);
        name = `c${hashId}_${name}`;
    
        // 3) truncate & append hash if over 48 chars
        if (name.length > 48) {
            name = `${name.slice(0, 47)}`;
        }
        console.log("tableNameForTag tag - ", tag, " -> ", name);
        return name;
    }

    private async createSqliteCacheTable(db: DatabaseConnection) {
        await db.exec(`CREATE TABLE IF NOT EXISTS lance_db_cache (
      uuid TEXT PRIMARY KEY,
      cacheKey TEXT NOT NULL,
      path TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      vector TEXT NOT NULL,
      startLine INTEGER NOT NULL,
      endLine INTEGER NOT NULL,
      contents TEXT NOT NULL
    )`);

        // Ensure `artifact_id` column exists (legacy migrations)
        await new Promise((resolve) =>
            migrate(
                "lancedb_sqlite_artifact_id_column",
                async () => {
                    const pragma = await db.all("PRAGMA table_info(lance_db_cache)");
                    const hasArtifactIdCol = pragma.some((p) => p.name === "artifact_id");
                    if (!hasArtifactIdCol) {
                        await db.exec(
                            "ALTER TABLE lance_db_cache ADD COLUMN artifact_id TEXT NOT NULL DEFAULT 'UNDEFINED'",
                        );
                    }
                },
                () => resolve(undefined),
            ),
        );
    }

    private async collectChunks(items: PathAndCacheKey[]): Promise<ChunkMap> {
        const map: ChunkMap = new Map();
        for (const item of items) {
            try {
                const content = await this.readFile(item.path);
                if (!shouldChunk(item.path, content)) {continue;}
                const chunks: Chunk[] = [];
                for await (const chunk of chunkDocument({
                    filepath: item.path,
                    contents: content,
                    maxChunkSize: this.embeddingsProvider.maxEmbeddingChunkSize,
                    digest: item.cacheKey,
                })) {
                    const cleanChunk = this.sanitizeEmbeddingInput(chunk.content);
                    if (cleanChunk !== null) {
                        chunks.push(chunk);
                    }
                }
                map.set(item.path, { item, chunks });
            } catch (e) {
                console.warn(`AstraDbIndex: failed to read & chunk ${item.path}:`, e);
            }
        }
        return map;
    }

    /*
    * Get invalid indices
    * Returns an array of indices of invalid chunks
    */
    private getInvalidIndices(chunks: Chunk[]): number[] {
        return chunks
            .map(c => ({ ...c, clean: this.sanitizeEmbeddingInput(c.content) }))
            .map((c, index) => c.clean === null ? index : null)
            .filter((c): c is number => c !== null);
    }

    /*
    * Get embeddings for chunks
    * Returns an array of embeddings after filtering out invalid chunks
    */
    private async getEmbeddings(chunks: Chunk[]): Promise<number[][]> {
        try {
            // Add some cleaning as the indexing failed several times with
            // Error: 400 '$.input' is invalid. Please check your input...
            const validChunks = chunks
            .map(c => ({ ...c, clean: this.sanitizeEmbeddingInput(c.content) }));
            
            const safeChunks = validChunks.filter(c => c.clean !== null);   // keep only safe ones

            // inputs you can pass straight to the embeddings call
            const embedInputs = safeChunks.map(c => c.clean as string);
            const embeddings = await this.embeddingsProvider.embed(embedInputs);
            return embeddings;
        } catch (err) {
            throw new Error(
                `Failed to generate embeddings for ${chunks.length} chunks with provider ${this.embeddingsProvider.embeddingId}: ${err}`,
            );
        }
    }

    private createAstraRows(chunkMap: ChunkMap, embeddings: number[][], tag: IndexTag): AstraRow[] {
        const rows: AstraRow[] = [];
        let idx = 0;
        for (const [, { item, chunks }] of chunkMap) {
            for (const chunk of chunks) {
                rows.push({
                    uuid: uuidv4(),
                    path: item.path,
                    cachekey: item.cacheKey,
                    startLine: chunk.startLine,
                    endLine: chunk.endLine,
                    contents: chunk.content,
                    metadata: {
                        filePath: item.path,
                        absPath: item.path.replace('file://', ''),
                        relativePath: item.path.replace('file://', '').replace(tag.directory || '', ''),
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        fileExtension: item.path.split('.').pop() ?? '',
                    },
                    $vector: embeddings[idx],
                } as AstraRow);
                idx++;
            }
        }
        return rows;
    }

    private async computeRows(items: PathAndCacheKey[], tag: IndexTag): Promise<AstraRow[]> {
        const chunkMap = await this.collectChunks(items);
        const allChunks = Array.from(chunkMap.values()).flatMap(({ chunks }) => chunks);
        const embeddings = await this.getEmbeddings(allChunks);
        const invalidIndices = this.getInvalidIndices(allChunks);

        // Iterate backwards through embeddings array to safely remove failed items
        // without changing the indices of the remaining items
        // We need to prune both the embeddings array and the corresponding chunks
        // from the chunkMap to keep them in sync
        for (let i = embeddings.length - 1; i >= 0; i--) {
            if (invalidIndices.includes(i)) {
                // Get the chunk that failed to embed
                const chunk = allChunks[i];
                // Find the array of chunks for this file path
                const arr = chunkMap.get(chunk.filepath)?.chunks;
                // If we found the array, remove the failed chunk from it
                if (arr) {arr.splice(arr.indexOf(chunk), 1);}
                // Remove the failed embedding
                embeddings.splice(i, 1);
            }
        }
        return this.createAstraRows(chunkMap, embeddings, tag);
    }

    /* --------------------------------------------------------------------------
     * Public API – update (indexing)  -----------------------------------------------------------*/

    async *update(
        tag: IndexTag,
        results: RefreshIndexResults,
        markComplete: MarkCompleteCallback,
        _repoName: string | undefined,
    ): AsyncGenerator<IndexingProgressUpdate> {
        const sqlite = await SqliteDb.get();
        await this.createSqliteCacheTable(sqlite);

        const collectionName = await this.tableNameForTag(tag);
        const db = this.db;

        // Ensure collection exists (creates if missing)
        const ensureCollection = async (
            dim: number,
        ): Promise<Collection<AstraRow>> => {
            const existing = await db.listCollections();
            const collExists = existing.some((c) => c.name === collectionName);
            if (collExists) {return db.collection<AstraRow>(collectionName);}
            return db.createCollection<AstraRow>(collectionName, {
                vector: {
                    dimension: dim,
                    metric: this.opts.metric,
                }
            });
        };

        /* ------------------------------------------------------------------
         * Step 1 – compute embeddings for files that changed (results.compute)
         * ----------------------------------------------------------------*/
        yield {
            progress: 0,
            desc: `Computing embeddings for ${results.compute.length} ${this.formatListPlurality(
                "file",
                results.compute.length,
            )}`,
            status: "indexing",
        };

        const computedRows = await this.computeRows(results.compute, tag);

        // Write to local cache first (mirrors old behaviour)
        await this.insertRows(sqlite, computedRows);

        // Upsert into Astra collection
        if (computedRows.length) {
            const coll = await ensureCollection(computedRows[0].$vector.length);
            await coll.insertMany(computedRows);
        }
        await markComplete(results.compute, IndexResultType.Compute);

        let progress = 0;

        /* ------------------------------------------------------------------
         * Step 2 – fast‑path for files that were previously cached but only
         *          need to be (re)tagged (results.addTag)
         * ----------------------------------------------------------------*/
        for (const { path, cacheKey } of results.addTag) {
            const stmt = await sqlite.prepare(
                "SELECT * FROM lance_db_cache WHERE cacheKey = ? AND artifact_id = ?",
                cacheKey,
                this.artifactId,
            );
            const cached = await stmt.all();
            if (cached.length) {
                const docs: AstraRow[] = cached.map((row) => ({
                    uuid: row.uuid,
                    path,
                    cachekey: cacheKey,
                    startLine: row.startLine,
                    endLine: row.endLine,
                    contents: row.contents,
                    metadata: {
                        filePath: row.path,
                        absPath: row.path.replace('file://', ''),
                        relativePath: row.path.replace('file://', '').replace(tag.directory || '', ''),
                        startLine: row.startLine,
                        endLine: row.endLine,
                        fileExtension: row.path.split('.').pop() ?? '',
                    },
                    $vector: JSON.parse(row.vector),
                }));
                const coll = await ensureCollection(docs[0].$vector.length);
                await coll.insertMany(docs);
            }
            await markComplete([{ path, cacheKey }], IndexResultType.AddTag);
            progress += 1 / results.addTag.length / 3;
            yield {
                progress,
                desc: `Indexing ${getUriPathBasename(path)}`,
                status: "indexing",
            };
        }

        /* ------------------------------------------------------------------
         * Step 3 – removals (removeTag & del)
         * ----------------------------------------------------------------*/
        const toRemove = [...results.removeTag, ...results.del];
        if (toRemove.length) {
            const coll = await db.collection<AstraRow>(collectionName);
            for (const { path, cacheKey } of toRemove) {
                await coll.deleteMany({ path, cachekey: cacheKey });
                progress += 1 / toRemove.length / 3;
                yield {
                    progress,
                    desc: `Removing ${getUriPathBasename(path)}`,
                    status: "indexing",
                };
            }
        }
        await markComplete(results.removeTag, IndexResultType.RemoveTag);

        /* Delete from local cache if file truly deleted */
        for (const { path, cacheKey } of results.del) {
            await sqlite.run(
                "DELETE FROM lance_db_cache WHERE cacheKey = ? AND path = ? AND artifact_id = ?",
                cacheKey,
                path,
                this.artifactId,
            );
        }
        await markComplete(results.del, IndexResultType.Delete);

        try {
            // Make sure we also update the remote server with the new index
            if (this.debuggAIServerClient) {
                const repoName = await this.debuggAIServerClient.getRepoName(tag.directory);
                await this.debuggAIServerClient.repos?.upsertVectorCollection(collectionName, tag.directory, tag.branch, this.artifactId, repoName);
            }
        } catch (err) {
            console.error("Error upserting vector collection", err);
        }

        yield { progress: 1, desc: "Completed calculating embeddings", status: "done" };
    }

    /* --------------------------------------------------------------------------
     * Public API – retrieve (vector search)  -----------------------------------*/

    async retrieve(
        query: string,
        n: number,
        tags: BranchAndDir[],
        filterDirectory: string | undefined,
    ): Promise<Chunk[]> {
        // 1) Turn query into embedding
        const chunks = [];
        for await (const ch of basicChunker(query, this.embeddingsProvider.maxEmbeddingChunkSize)) {
            chunks.push(ch);
        }
        let [queryVector] = await this.embeddingsProvider.embed(chunks.map((c) => c.content));

        // 2) Search across collections for each tag
        const db = this.db;
        let hits: { _distance: number; doc: AstraRow }[] = [];

        for (const tag of tags) {
            const collName = await this.tableNameForTag({ ...tag, artifactId: this.artifactId });
            const collections = await db.listCollections();
            if (!collections.some((c) => c.name === collName)) {continue;}
            const coll = db.collection<AstraRow>(collName);

            const searchOpts: any = { limit: n, includeSimilarity: true };
            if (filterDirectory) {
                searchOpts.filter = { path: { $like: `${filterDirectory}%` } };
            }
            // @ts-ignore – the client currently uses `findVector` in >=1.3.0
            const res = await coll.findVector(queryVector, searchOpts);
            hits.push(...res.map((r: any) => ({ _distance: r.$similarity, doc: r })));
        }

        hits = hits.sort((a, b) => a._distance - b._distance).slice(0, n);

        // 3) Hydrate from local sqlite cache to preserve identical return shape
        const sqlite = await SqliteDb.get();
        const rows = await sqlite.all(
            `SELECT * FROM lance_db_cache WHERE uuid in (${hits
                .map((h) => `'${h.doc.uuid}'`)
                .join(",")})`,
        );
        return rows.map((d) => ({
            digest: d.cacheKey,
            filepath: d.path,
            startLine: d.startLine,
            endLine: d.endLine,
            index: 0,
            content: d.contents,
        }));
    }

    /* --------------------------------------------------------------------------
     * Local cache helpers  ------------------------------------------------------*/

    private async insertRows(db: DatabaseConnection, rows: AstraRow[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const nullCount = rows.filter(r => r.$vector == null).length;
            if (nullCount) {
                throw new Error(`BUG: about to insert ${nullCount} NULL vectors`);
            }

            db.db.serialize(() => {
                db.db.exec("BEGIN", (err: Error | null) => {
                    if (err) {return reject(err);}
                });
                const sql =
                    "INSERT INTO lance_db_cache (uuid, cacheKey, path, artifact_id, vector, startLine, endLine, contents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
                rows.forEach((r) => {
                    db.db.run(
                        sql,
                        [
                            r.uuid,
                            r.cachekey,
                            r.path,
                            this.artifactId,
                            JSON.stringify(r.$vector),
                            r.startLine,
                            r.endLine,
                            r.contents,
                        ],
                        (err: Error | null) => {
                            if (err) {return reject(err);}
                        },
                    );
                });
                db.db.exec("COMMIT", (err: Error | null) => {
                    if (err) {return reject(err);}
                    resolve();
                });
            });
        });
    }

    private formatListPlurality(word: string, len: number) {
        return len === 1 ? word : `${word}s`;
    }

    /**
     * Make a string safe for the OpenAI embeddings endpoint.
     * – trims whitespace
     * – rejects empty strings
     * – rejects inputs that would exceed the model’s token limit
     *
     * @returns the cleaned text, or `null` if it should be skipped
     */
    private sanitizeEmbeddingInput(raw: string): string | null {
        const trimmed = raw.trim();
    
        if (!trimmed) {return null;} // nothing to embed
        if (trimmed.length > this.embeddingsProvider.maxEmbeddingChunkSize * 4) {return null;}
    
        // add any other checks / transforms here
        return trimmed;
    }
}
