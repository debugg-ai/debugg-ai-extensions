import { ConfigHandler } from "../../config/ConfigHandler.js";
import { ControlPlaneSessionInfo } from "../../control-plane/client.js";
import { IDE } from "../../index.js";
import { CoverageService, createCoverageService } from "../services/coverage.js";
import { createE2esService, E2esService } from "../services/e2es.js";
import { createIndexesService, IndexesService } from "../services/indexes.js";
import { createIssuesService, IssuesService } from "../services/issues.js";
import { createReposService, ReposService } from "../services/repos.js";
import { createUsersService, UsersService } from "../services/users.js";
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
  indexes: IndexesService | undefined;
  coverage: CoverageService | undefined;
  e2es: E2esService | undefined;
  users: UsersService | undefined;
  
  constructor(
    private readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private userToken?: string,
  ) {
    this.init();
  }

  private async init() {
    const serverUrl = await this.getServerUrl();
    console.log("Server URL:", serverUrl);

    this.url = new URL(serverUrl);
    this.accessToken = await this.getAccessToken();
    this.userToken = this.accessToken;
    this.tx = new AxiosTransport({ baseUrl: serverUrl, token: this.accessToken });
    this.repos = createReposService(this.tx);
    this.issues = createIssuesService(this.tx);
    this.indexes = createIndexesService(this.tx);
    this.coverage = createCoverageService(this.tx);
    this.e2es = createE2esService(this.tx);
    this.users = createUsersService(this.tx);
  }
  
  public async updateSessionInfo(sessionInfo?: ControlPlaneSessionInfo) {
    console.log("Updating Debugg AI client session info...", sessionInfo);
    this.init();
  }

  public async getUserId(): Promise<string | undefined> {
    return await this.configHandler.controlPlaneClient.userId;
  }

  private async getAccessToken(): Promise<string> {
    const accessToken =
      await this.configHandler.controlPlaneClient.getAccessToken();
    if (!accessToken) {
      throw new Error("No access token found");
    }
    return accessToken;
  }

  public async awaitInit() {
    await this.init();
  }
  
  /**
   * Get the server URL based on the deployment environment
   * @returns The server URL
   */
  private async getServerUrl(): Promise<string> {
    return await this.configHandler.controlPlaneClient.getBaseApiUrl();

  }

  public async getRepoName(filePath: string): Promise<string | undefined> {
    return await this.ide.getRepoName(filePath);
  }

  public async getRepoInfo(filePath: string): Promise<{
    repoName: string | undefined;
    repoPath: string | undefined;
    branchName: string | undefined;
  }> {
    const repoName = await this.ide.getRepoName(filePath);
    if (!repoName) {
     console.debug("No repo name found for file");
    }
    let repoPath = await this.ide.getGitRootPath(filePath);
    if (!repoPath) {
      console.debug("No repo path found for file");
    } else{
      repoPath = repoPath?.replace('file://', "");
    }
    const branchName = await this.ide.getBranch(filePath);
    if (!branchName) {
      console.debug("No branch name found for file");
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
    const response = await this.users?.getUserConfig();
    if (!response) {
      throw new Error("No user config found");
    }
    return { configJson: JSON.stringify(response) };
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

    // If no keys are provided, return an empty object
    if (keys.length === 0) {
      return {
        files: {},
      };
    }
    console.log("Getting from index cache for keys:", keys, "and artifactId:", artifactId, "and repoName:", repoName);
    const url = new URL("indexing/cache", this.url);

    const userToken = this.userToken;
    if (!userToken) {
      throw new Error("No user token provided");
    }
    try {
      const data = await this.indexes?.getIndexes({
        accessToken: userToken,
        projectKey: repoName ?? "NONE",
        keys,
        artifactId,
        repo: repoName ?? "NONE",
      });

      return data?.[0] ?? {
        files: {},
      };
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
