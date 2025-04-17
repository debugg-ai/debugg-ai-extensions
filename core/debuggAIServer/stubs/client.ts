import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ControlPlaneSessionInfo } from "../../control-plane/client.js";
import { IDE } from "../../index.js";
import { IndexesService } from "../services/indexes.js";
import { createIssuesService, IssuesService } from "../services/issues.js";
import { createReposService, ReposService } from "../services/repos.js";
import { AxiosTransport } from "../utils/axiosTransport.js";

import type {
  ArtifactType,
  EmbeddingsCacheResponse,
  IDebuggAIServerClient,
} from "../interface.js";


export class DebuggAIServerClient implements IDebuggAIServerClient {
  private tx: AxiosTransport | undefined;
  private accessToken: string | undefined;
  url: URL | undefined;

  // Public “sub‑APIs”
  repos: ReposService | undefined;
  issues: IssuesService | undefined;

  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private readonly userToken?: string,
  ) {
    this.init();
  }

  private async init() {
    const serverUrl = await this.getServerUrl();
    console.log("Server URL:", serverUrl);

    this.url = new URL(serverUrl);
    this.accessToken = await this.getAccessToken();
    this.tx = new AxiosTransport({ baseUrl: serverUrl, token: this.accessToken });
    this.repos = createReposService(this.tx);
    this.issues = createIssuesService(this.tx);
  }
  
  public async updateSessionInfo(sessionInfo?: ControlPlaneSessionInfo) {
    console.log("Updating Debugg AI client session info...", sessionInfo);
    this.init();
  }

  private async getAccessToken(): Promise<string> {
    const accessToken =
      await this.configHandler.controlPlaneClient.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token found");
    }
    return accessToken;
  }

  /**
   * Get the server URL based on the deployment environment
   * @returns The server URL
   */
  private async getServerUrl(): Promise<string> {
    const { config } = await this.configHandler.loadConfig();
    const env = config?.deploymentEnv ?? "local";
    const localUrl = "http://localhost:81";
    const prodUrl = "https://api.debugg.ai";

    return env === "production" ? prodUrl : localUrl;
  }

  public async getRepoInfo(filePath: string): Promise<{
    repoName: string;
    repoPath: string;
    branchName: string;
  }> {
    const repoName = await this.ide.getRepoName(filePath);
    if (!repoName) {
      throw new Error("No repo name found for file");
    }
    const repoPath = await this.ide.getGitRootPath(filePath);
    if (!repoPath) {
      throw new Error("No repo path found for file");
    }
    const branchName = await this.ide.getBranch(filePath);
    if (!branchName) {
      throw new Error("No branch name found for file");
    }
    return { repoName, repoPath, branchName };
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
