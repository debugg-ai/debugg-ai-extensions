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

import { AxiosRequestConfig } from "axios";
import type {
  ArtifactType,
  EmbeddingsCacheResponse,
  IDebuggAIServerClient,
} from "../interface.js";

/**
 * Global singleton manager for DebuggTransport instances.
 * This prevents re-initialization of transport when init() is called multiple times.
 */
export class DebuggTransportManager {
  private static instance: DebuggTransportManager;
  private transports: Map<string, DebuggTransport> = new Map();

  private constructor() {}

  public static getInstance(): DebuggTransportManager {
    if (!DebuggTransportManager.instance) {
      DebuggTransportManager.instance = new DebuggTransportManager();
    }
    return DebuggTransportManager.instance;
  }

  /**
   * Get or create a DebuggTransport instance for the given IDE and server URL.
   * The transport is cached by a combination of IDE instance and server URL.
   */
  public getOrCreateTransport(ide: IDE, serverUrl: string, token?: string, onAuthFailure?: () => void): DebuggTransport {
    const key = `${ide.constructor.name}-${serverUrl}`;
    
    console.log(`TransportManager.getOrCreateTransport called with key: ${key}, token: ${token?.substring(0, 10)}...`);
    console.log(`Current transport count: ${this.transports.size}`);
    console.log(`Existing keys:`, Array.from(this.transports.keys()));
    
    if (!this.transports.has(key)) {
      console.log(`Creating new DebuggTransport for key: ${key}`);
      this.transports.set(key, new DebuggTransport(ide, serverUrl, token, onAuthFailure));
    } else {
      console.log(`Reusing existing DebuggTransport for key: ${key}`);
      const existingTransport = this.transports.get(key)!;
      console.log(`Existing transport auth header before update: ${existingTransport.getAuthorizationHeader()}`);
      // Always update token if provided to ensure we have the latest
      if (token) {
        console.log(`Updating token for existing transport: ${token.substring(0, 10)}...`);
        existingTransport.updateToken(token);
      }
      // Update the auth failure callback if provided
      if (onAuthFailure) {
        existingTransport.onAuthFailure = onAuthFailure;
      }
      console.log(`Existing transport auth header after update: ${existingTransport.getAuthorizationHeader()}`);
    }
    
    const transport = this.transports.get(key)!;
    console.log(`Returning transport with auth header: ${transport.getAuthorizationHeader()}`);
    return transport;
  }

  /**
   * Clear all cached transports (useful for testing or when IDE changes)
   */
  public clearTransports(): void {
    this.transports.clear();
  }

  /**
   * Get the number of cached transports (useful for debugging)
   */
  public getTransportCount(): number {
    return this.transports.size;
  }
}

/**
 * AxiosTransport with project information added to the call.
 */
export class DebuggTransport extends AxiosTransport {
  /**
   * The IDE instance to use for the transport.
   */
  private ide: IDE;
  public token?: string;

  constructor(ide: IDE, baseUrl: string, token?: string, onAuthFailure?: () => void) {
    super({ baseUrl, token });
    this.ide = ide;
    this.token = token;
    this.onAuthFailure = onAuthFailure;
  }

  /**
   * Update the token for this transport instance.
   */
  public updateToken(token: string): void {
    console.log(`DebuggTransport.updateToken called with token: ${token.substring(0, 10)}...`);
    this.token = token;
    // Update the underlying AxiosTransport token
    super.updateToken(token);
    console.log(`DebuggTransport current auth header: ${this.getAuthorizationHeader()}`);
  }

  /**
   * Get the current authorization header for debugging.
   */
  public getAuthorizationHeader(): string | undefined {
    return super.getAuthorizationHeader();
  }

  /*
   Nearly every api call is going to need the information about the project. 
   This function will add the project information to the call.
  */
  public async addProjectToCall(): Promise<{
    repoName: string | undefined,
    repoPath: string | undefined,
    branchName: string | undefined,
    filePath?: string | undefined,
  }> {

    const curdirs = await this.ide.getWorkspaceDirs();
    console.log("curdirs -", curdirs);
    const curdir = curdirs?.[0];
    const gitRootPath = (await this.ide.getGitRootPath(curdir))?.replace('file://', "");
    if (!gitRootPath) return { repoName: undefined, repoPath: undefined, branchName: undefined };
    const repoName = await this.ide.getRepoName(gitRootPath);
    const branchName = await this.ide.getBranch(gitRootPath);
    const extraParams = { repoName, repoPath: gitRootPath, branchName, isExtension: true };

    console.log("extraParams -", extraParams);
    if (await this.ide.getCurrentFile()) {
      const curFile = await this.ide.getCurrentFile();
      if (curFile?.path) {
        console.log("curFile -", curFile.path);
        return { ...extraParams, filePath: curFile.path };
      }
    }
    return extraParams;
  }

  async get<T = unknown>(url: string, params?: any, addProjectToCall?: boolean) {
    const extraParams = addProjectToCall ? await this.addProjectToCall() : {};
    const getResponse = await super.get<T>(url, { ...params, ...extraParams });
    return getResponse;
  }

  async post<T = unknown>(url: string, data?: any, cfg?: AxiosRequestConfig, addProjectToCall?: boolean) {
    // For post calls, we default to injecting the project information.
    const extraParams = addProjectToCall === undefined || addProjectToCall === true ? await this.addProjectToCall() : {};
    return super.post<T>(url, { ...data, ...extraParams }, cfg);
  }
}

export class DebuggAIServerClient implements IDebuggAIServerClient {
  private cachedAccessTokenRefresh: boolean = false;
  private tx: DebuggTransport | undefined;
  private accessToken: string | undefined;
  private initialized: boolean = false;
  private initStarted: boolean = false;
  url: URL | undefined;

  // Public "sub‑APIs"
  repos: ReposService | undefined;
  issues: IssuesService | undefined;
  indexes: IndexesService | undefined;
  coverage: CoverageService | undefined;
  e2es: E2esService | undefined;
  users: UsersService | undefined;

  constructor(
    public readonly configHandler: ConfigHandler,
    private readonly ide: IDE,
    private userToken?: string,
  ) {
    this.init();
  }

  private async init() {
    if (this.initStarted) {
      console.log("Init already started, waiting for completion...");
      return;
    }
    
    this.initStarted = true;
    console.log("Starting DebuggAIServerClient init...");
    
    const serverUrl = await this.getServerUrl();
    console.log("Server URL:", serverUrl);

    this.url = new URL(serverUrl);
    this.accessToken = await this.getAccessToken();
    this.userToken = this.accessToken;
    console.log("Got access token:", this.accessToken?.substring(0, 10) + "...");
    
    // Use the singleton transport manager to get or create the transport
    const transportManager = DebuggTransportManager.getInstance();
    this.tx = transportManager.getOrCreateTransport(
      this.ide, 
      serverUrl, 
      this.accessToken,
      () => this.refreshTokenAndUpdateTransport()
    );
    console.log("Transport created with auth header:", this.tx.getAuthorizationHeader());

    this.repos = createReposService(this.tx);
    this.issues = createIssuesService(this.tx);
    this.indexes = createIndexesService(this.tx);
    this.coverage = createCoverageService(this.tx);
    this.e2es = createE2esService(this.tx);
    this.users = createUsersService(this.tx);
    this.initialized = true;
    this.initStarted = false;
    console.log("DebuggAIServerClient init completed");
  }

  public async updateSessionInfo(sessionInfo?: ControlPlaneSessionInfo) {
    console.log("Updating Debugg AI client session info...", sessionInfo);
    this.accessToken = sessionInfo?.accessToken;
    
    // Update the transport token if we have a transport instance
    if (this.tx && this.accessToken) {
      this.tx.updateToken(this.accessToken);
      // Recreate services with the updated transport to ensure they use the new token
      this.repos = createReposService(this.tx);
      this.issues = createIssuesService(this.tx);
      this.indexes = createIndexesService(this.tx);
      this.coverage = createCoverageService(this.tx);
      this.e2es = createE2esService(this.tx);
      this.users = createUsersService(this.tx);
    }
    
    // Only re-init if we don't have a transport yet
    if (!this.tx) {
      await this.init();
    }
  }

  /**
   * Refresh the access token and update the transport.
   * This should be called when authentication failures are detected.
   */
  public async refreshTokenAndUpdateTransport(): Promise<void> {
    console.log("Refreshing token and updating transport...");
    try {
      const newToken = await this.getAccessToken();
      if (newToken && this.tx) {
        console.log(`Successfully refreshed token to: ${newToken.substring(0, 10)}...`);
        this.tx.updateToken(newToken);
      }
    } catch (error) {
      console.error("Failed to refresh token:", error);
      throw error;
    }
  }

  public async getUserId(): Promise<string | undefined> {
    return await this.configHandler.controlPlaneClient.userId;
  }

  public async getAccessToken(): Promise<string> {
    let accessToken =
      await this.configHandler.controlPlaneClient.getAccessToken();
    if (!accessToken) {
      // If we don't have an access token, we need to refresh it
      if (!this.cachedAccessTokenRefresh) {
        this.cachedAccessTokenRefresh = true;
        await new Promise(resolve => setTimeout(resolve, 1500));
        // await this.configHandler.reloadConfig();
        accessToken = await this.configHandler.controlPlaneClient.getAccessToken();

        setTimeout(() => {
          this.cachedAccessTokenRefresh = false;
        }, 30_000);
      } 
      // Check again if we have an access token, if not, throw an error
      if (!accessToken) {
        // Don't loop ourselves forever if we don't have an access token
        console.error("No access token found");
        throw new Error("No access token found");
      }
    }
    
    // Update the transport token if it's different from the current one
    if (accessToken && this.tx && accessToken !== this.accessToken) {
      console.log(`Token refreshed, updating transport from ${this.accessToken?.substring(0, 10)}... to ${accessToken.substring(0, 10)}...`);
      this.accessToken = accessToken;
      this.userToken = accessToken;
      this.tx.updateToken(accessToken);
    }
    
    return accessToken;
  }

  public async awaitInit() {
    if (!this.initialized && !this.initStarted) {
      await this.init();
    } else if (!this.initialized && this.initStarted) {
      console.log("Waiting for init to complete...");
      // await new Promise(resolve => setTimeout(resolve, 500));
      await new Promise(resolve => {
        const interval = setInterval(() => {
          if (this.initialized) {
            clearInterval(interval);
            resolve(undefined);
          }
        }, 500);
      });
    }
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
    } else {
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
