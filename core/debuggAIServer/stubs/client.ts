import type {
  ArtifactType,
  EmbeddingsCacheResponse,
  IDebuggAIServerClient,
} from "../interface.js";
import { IndexesService } from "../services/indexes.js";
import { createReposService, ReposService } from "../services/repos.js";
import { AxiosTransport } from "../utils/axiosTransport.js";


export class DebuggAIServerClient implements IDebuggAIServerClient {
  private readonly tx: AxiosTransport;
  url: URL | undefined;

  // Public “sub‑APIs”
  readonly repos: ReposService;

  constructor(serverUrl: string | undefined, private readonly userToken?: string) {
    // Validate that the server URL starts with http:// or https://
    if (!serverUrl || !/^https?:\/\//.test(serverUrl)) {
      throw new Error("Invalid DebuggAI server URL");
    }
    this.url = new URL(serverUrl);
    // Create axios transport instance
    this.tx = new AxiosTransport({ baseUrl: serverUrl, token: userToken ?? "" });
    // wire up services
    this.repos = createReposService(this.tx);
  }

  getUserToken(): string | undefined {
    return this.userToken;
  }

  get connected(): boolean {
    return this.url !== undefined && this.userToken !== undefined;
  }

  public async getConfig(): Promise<{ configJson: string }> {
    // TODO: Implement this on the backend
    const userToken = await this.userToken;
    const response = await fetch(new URL("sync", this.url).href, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to sync remote config (HTTP ${response.status}): ${response.statusText}`,
      );
    }
    const data = await response.json();
    return data;
  }

  public async getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>> {
    if (repoName === undefined) {
      console.warn(
        "No repo name provided to getFromIndexCache, this may cause no results to be returned.",
      );
    }

    if (keys.length === 0) {
      return {
        files: {},
      };
    }
    const url = new URL("indexing/cache", this.url);

    const userToken = this.userToken;
    if (!userToken) {
      throw new Error("No user token provided");
    }
    try {
      const data = await IndexesService.getIndexes({
        accessToken: userToken,
        projectKey: repoName ?? "NONE",
        keys,
        artifactId,
        repo: repoName ?? "NONE",
      });

      return data?.[0];
    } catch (e) {
      console.warn("Failed to retrieve from remote cache", e);
      return {
        files: {},
      };
    }
  }

  public async sendFeedback(feedback: string, data: string): Promise<void> {
    if (!this.url) {
      return;
    }

    const url = new URL("feedback", this.url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.userToken}`,
      },
      body: JSON.stringify({
        feedback,
        data,
      }),
    });
  }
  
}
