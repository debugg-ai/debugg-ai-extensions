import { AxiosResponse } from "axios";
import { ArtifactType, EmbeddingsCacheResponse } from "../interface";
import { AxiosTransport } from "../utils/axiosTransport";
/**
 * Service for retrieving embeddings cache responses from the server.
 * 
 * This service provides a method to fetch embeddings cache responses for specified artifact types.
 * It handles the HTTP request and response parsing to retrieve the embeddings cache data.
 * */

export interface IndexesService {
  getIndexes<T extends ArtifactType>(params: {
    accessToken: string;
    projectKey: string;
    keys: string[];
    artifactId: T;
    repo: string;
  }): Promise<EmbeddingsCacheResponse<T>[]>;
}


export const createIndexesService = (tx: AxiosTransport): IndexesService => ({
  /**
   * Retrieves embeddings cache responses for specified artifact types.
   * 
   * @param params - The parameters for the request.
   * @param params.accessToken - The access token for authentication.
   * @param params.projectKey - The project key for the repository.
   * @param params.keys - The keys to retrieve from the cache.
   * @param params.artifactId - The artifact type to retrieve.
   * @param params.repo - The repository name.
   * @returns An array of embeddings cache responses.
   */
  async getIndexes<T extends ArtifactType>(params: {
    accessToken: string;
    projectKey: string;
    keys: string[];
    artifactId: T;
    repo: string;
  }): Promise<EmbeddingsCacheResponse<T>[]> {
    console.log('TODO: Indexes not implemented. Returning empty array. Getting indexes', params);
    return [];
    const response = await tx.post("/api/v1/indexes", {
      params,
    }) as AxiosResponse<EmbeddingsCacheResponse<T>[]>;

    if (response.status !== 200) {
        const text = await response.data;
        console.warn(
          `Failed to retrieve from remote cache (HTTP ${response.status}): ${text}`,
        );
        return [];
    }
    return response.data;
  },
});
