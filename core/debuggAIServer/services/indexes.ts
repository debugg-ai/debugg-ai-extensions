import { ArtifactType, EmbeddingsCacheResponse } from '../interface';
import { post } from '../utils/axios';


export const IndexesService = {
  async getIndexes<T extends ArtifactType>(params: {
    accessToken: string;
    projectKey: string;
    keys: string[];
    artifactId: T;
    repo: string;
  }): Promise<EmbeddingsCacheResponse<T>[]> {
    const response = await post(`/api/v1/indexes`, {
      params,
    });

    if (response.status !== 200) {
        const text = await response.data;
        console.warn(
          `Failed to retrieve from remote cache (HTTP ${response.status}): ${text}`,
        );
        return []
    }
    return response.data;
  },
};
