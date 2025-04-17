import { Chunk } from "../index.js";

import { IssuesService } from "./services/issues.js";
import { ReposService } from "./services/repos.js";
export interface EmbeddingsCacheChunk {
  vector: number[];
  startLine: number;
  endLine: number;
  contents: string;
}

interface ArtifactReturnTypes {
  chunks: Chunk[];
  embeddings: EmbeddingsCacheChunk[];
}

export type ArtifactType = keyof ArtifactReturnTypes;

export interface EmbeddingsCacheResponse<T extends ArtifactType> {
  files: { [cacheKey: string]: ArtifactReturnTypes[T] };
}

export interface IDebuggAIServerClient {
  connected: boolean;
  url: URL | undefined;
  repos: ReposService | undefined;
  issues: IssuesService | undefined;
  getUserToken(): string | undefined;
  getConfig(): Promise<{ configJson: string }>;
  getRepoInfo(filePath: string): Promise<{ repoName: string; repoPath: string; branchName: string }>;
  getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>>;
}
