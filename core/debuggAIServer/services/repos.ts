// services/repos.ts
import { AxiosTransport } from "../utils/axiosTransport";

export interface ReposService {
  upsertVectorCollection(
    collectionName: string,
    directory: string,
    branch: string,
    artifactId: string,
  ): Promise<void>;
  deleteVectorCollection(collectionName: string): Promise<void>;
}

export const createReposService = (
  tx: AxiosTransport,
): ReposService => ({
  async upsertVectorCollection(collectionName, directory, branch, artifactId) {
    console.log("upsertVectorCollection - ", collectionName, directory, branch, artifactId);
    await tx.post("/api/v1/collections/upsert", {
      collectionName,
      directory,
      branch,
      artifactId,
    });
  },

  async deleteVectorCollection(collectionName) {
    console.log("deleteVectorCollection - ", collectionName);
    await tx.delete(`/api/v1/collections/${collectionName}`);
  },
});
