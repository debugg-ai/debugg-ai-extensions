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

  private constructor() { }

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
        console.log(`Token update completed for transport instanceId: ${(existingTransport as any).axios?.instanceId || 'unknown'}`);
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

// Utility: Exponential backoff wrapper for API calls
async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (err: any) => boolean;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 6;
  const initialDelayMs = options?.initialDelayMs ?? 500;
  const maxDelayMs = options?.maxDelayMs ?? 10000;
  const shouldRetry =
    options?.shouldRetry ||
    ((err) => {
      if (!err) return false;
      // Retry on network errors, 5xx, and 429
      if (err.response) {
        const status = err.response.status;
        return status >= 500 || status === 429;
      }
      // Retry on fetch/axios network errors
      return true;
    });

  let attempt = 0;
  let delay = initialDelayMs;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(err)) {
        throw err;
      }
      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15x
      const wait = Math.min(delay * jitter, maxDelayMs);
      console.warn(
        `API call failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(
          wait
        )}ms...`,
        (err as any)?.message || err
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}

export class DebuggAIServerClient implements IDebuggAIServerClient {
  private cachedAccessTokenRefresh: boolean = false;
  private tokenRefreshInProgress: boolean = false;
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

  private inFlightGetAccessToken: Promise<string> | null = null;
  private inFlightGetConfig: Promise<{ configJson: string }> | null = null;
  private inFlightRefreshSessions: Promise<void> | null = null;
  private consecutive401s: number = 0;
  private static readonly MAX_401_ATTEMPTS = 3;

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
    
    // Auth is now handled by AuthManager, so we can proceed directly
    
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
      () => this.forceRefreshToken()
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
      const newToken = await this.forceRefreshToken();
      if (newToken && this.tx) {
        console.log(`Successfully refreshed token to: ${newToken.substring(0, 10)}...`);
        this.tx.updateToken(newToken);

        // Test the new token with a simple API call
        try {
          await this.users?.getUserConfig();
          console.log("Token refresh successful - API call works");
        } catch (testError) {
          console.error("Token refresh failed - API call still fails:", testError);
        }
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
    if (this.inFlightGetAccessToken) return this.inFlightGetAccessToken;
    this.inFlightGetAccessToken = withExponentialBackoff(async () => {
      let accessToken: string | undefined;
      
      // Try to get access token from AuthManager first
      if (this.configHandler.authManager) {
        const token = this.configHandler.authManager.getAccessToken();
        accessToken = token || undefined;
        if (accessToken) {
          console.log(`getAccessToken from AuthManager: ${accessToken.substring(0, 10)}...`);
        } else {
          // Try to wait for auth with a reasonable timeout
          try {
            const session = await this.configHandler.authManager.waitForAuth(3000);
            if (session?.accessToken) {
              accessToken = session.accessToken;
              console.log(`getAccessToken after waiting: ${accessToken.substring(0, 10)}...`);
            }
          } catch (error) {
            console.warn("AuthManager timeout, falling back to legacy auth:", error);
          }
        }
      }
      
      // Fallback to legacy auth provider if AuthManager didn't provide token
      if (!accessToken && this.configHandler.debuggAIAuthProvider) {
        const sessions = await this.configHandler.debuggAIAuthProvider.getSessions();
        if (sessions.length > 0) {
          accessToken = sessions[0].accessToken;
          console.log(`getAccessToken from legacy provider: ${accessToken?.substring(0, 10)}...`);
        }
      }
      
      if (!accessToken) {
        console.log("No access token found, attempting control plane fallback...");
        if (!this.cachedAccessTokenRefresh) {
          this.cachedAccessTokenRefresh = true;
          await new Promise(resolve => setTimeout(resolve, 1500));
          accessToken = await this.configHandler.controlPlaneClient.getAccessToken();
          console.log(`After control plane attempt: ${accessToken?.substring(0, 10)}...`);
          setTimeout(() => {
            this.cachedAccessTokenRefresh = false;
          }, 30_000);
        }
        if (!accessToken) {
          console.error("No access token found from any source");
          throw new Error("No access token found");
        }
      }
      if (accessToken && this.tx && accessToken !== this.accessToken) {
        console.log(`Token refreshed, updating transport from ${this.accessToken?.substring(0, 10)}... to ${accessToken.substring(0, 10)}...`);
        this.accessToken = accessToken;
        this.userToken = accessToken;
        this.tx.updateToken(accessToken);
      }
      return accessToken;
    }, { maxRetries: 6, initialDelayMs: 500, maxDelayMs: 10000 })
      .finally(() => { this.inFlightGetAccessToken = null; });
    return this.inFlightGetAccessToken;
  }

  /**
   * Wait for the auth provider to be available.
   */
  public async waitForAuthProvider(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 20; // More attempts for initialization
    while (!this.configHandler.debuggAIAuthProvider && attempts < maxAttempts) {
      console.log(`Waiting for auth provider to be available... (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 250));
      attempts++;
    }
    
    if (!this.configHandler.debuggAIAuthProvider) {
      throw new Error(`Auth provider not available after ${maxAttempts} attempts`);
    }
    
    // Also wait for sessions to be available
    attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const sessions = await this.configHandler.debuggAIAuthProvider.getSessions();
        if (sessions.length > 0 && sessions[0].accessToken) {
          console.log("Auth provider is now available with valid sessions");
          return;
        }
      } catch (error) {
        console.log(`Waiting for sessions to be available... (attempt ${attempts + 1}/${maxAttempts})`);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
      attempts++;
    }
    
    throw new Error(`Auth provider sessions not available after ${maxAttempts} attempts`);
  }

  /**
   * Force refresh the token by clearing the cache and getting a new one.
   */
  public async forceRefreshToken(): Promise<string> {
    if (this.tokenRefreshInProgress) {
      console.log("Token refresh already in progress, skipping...");
      return this.accessToken || '';
    }

        console.log("Force refreshing token...");
    this.tokenRefreshInProgress = true;
    this.cachedAccessTokenRefresh = false;
    
    // Ensure auth provider is available before attempting refresh
    await this.waitForAuthProvider();
    
    // Don't reload config here as it creates a circular dependency
    // Instead, just get the token directly from the control plane client
    let newToken: string | undefined;
    
    try {
      // Try to get a fresh token without reloading config
      console.log("Current token before refresh:", this.accessToken?.substring(0, 10) + "...");
      
      // Note: Token refresh is handled at the IDE level via messenger
      console.log("Token refresh is handled at the IDE level");

      // Run the actual refresh
      if (this.configHandler.debuggAIAuthProvider) {
        await this.configHandler.debuggAIAuthProvider.refreshSessions();
      }
      // Get the new token from the store
      newToken = await this.getAccessToken();
      console.log(`Got fresh token: ${newToken?.substring(0, 10)}...`);

      if (!newToken) {
        console.log("No fresh token available, attempting config reload...");
        // Only reload config if we don't have a token
        // await this.configHandler.reloadConfig();
        newToken = await this.getAccessToken();
        console.log(`After config reload, got token: ${newToken?.substring(0, 10)}...`);
      }

      if (newToken === this.accessToken) {
        console.log("⚠️ Warning: New token is the same as current token!");
        console.log("This suggests the token refresh didn't work properly on the server side");
      } else {
        console.log("✅ New token is different from current token");
      }
    } catch (error) {
      console.error("Failed to get fresh token:", error);
      this.tokenRefreshInProgress = false;
      throw error;
    }

    if (newToken && this.tx) {
      console.log(`Force refreshed token to: ${newToken.substring(0, 10)}...`);
      this.tx.updateToken(newToken);

      // Verify the token was actually updated
      console.log(`Transport auth header after force refresh: ${this.tx.getAuthorizationHeader()}`);
      this.tx.verifyTokenConfiguration();

      // Test the new token immediately
      try {
        console.log("Testing new token with API call...");
        console.log("Waiting 1 second before testing to allow server to process token refresh...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Make a direct API call to test the token without going through the service layer
        if (this.tx) {
          console.log("Making direct API call to test token...");
          await this.tx.get("api/v1/users/get_ide_config/");
          console.log("✅ New token works!");
        } else {
          console.error("❌ No transport available for testing");
        }
      } catch (testError) {
        console.error("❌ New token still fails:", testError);
        console.error("This suggests the token refresh didn't resolve the authentication issue");
      }
    }

    this.tokenRefreshInProgress = false;
    return newToken || '';
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
    return this.url !== undefined && this.userToken !== undefined && this.initialized;
  }

  public async getConfig(): Promise<{ configJson: string }> {
    if (this.inFlightGetConfig) return this.inFlightGetConfig;
    this.inFlightGetConfig = withExponentialBackoff(async () => {
      const userToken = await this.userToken;
      try {
        const response = await this.users?.getUserConfig();
        this.consecutive401s = 0; // Reset on success
        if (!response) {
          throw new Error("No user config found");
        }
        return { configJson: JSON.stringify(response) };
      } catch (err: any) {
        // Check for 401 Unauthorized
        const status = err?.response?.status || err?.status;
        if (status === 401) {
          this.consecutive401s++;
          if (this.consecutive401s >= DebuggAIServerClient.MAX_401_ATTEMPTS) {
            this.consecutive401s = 0;
            if (this.configHandler.debuggAIAuthProvider && this.configHandler.debuggAIAuthProvider.clearSessions) {
              await this.configHandler.debuggAIAuthProvider.clearSessions();
            }
            throw new Error("Authentication failed 3 times in a row. Please log in again.");
          }
        }
        throw err;
      }
    }, { maxRetries: 6, initialDelayMs: 500, maxDelayMs: 10000 })
      .finally(() => { this.inFlightGetConfig = null; });
    return this.inFlightGetConfig;
  }

  public async getFromIndexCache<T extends ArtifactType>(
    keys: string[],
    artifactId: T,
    repoName: string | undefined,
  ): Promise<EmbeddingsCacheResponse<T>> {
    return withExponentialBackoff(async () => {
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
        throw e;
      }
    }, { maxRetries: 6, initialDelayMs: 500, maxDelayMs: 10000 });
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

  // Helper for external callers to debounce refreshSessions
  public async refreshSessionsDebounced(): Promise<void> {
    if (this.inFlightRefreshSessions) return this.inFlightRefreshSessions.then(() => {});
    if (this.configHandler.debuggAIAuthProvider && this.configHandler.debuggAIAuthProvider.refreshSessions) {
      this.inFlightRefreshSessions = this.configHandler.debuggAIAuthProvider.refreshSessions()
        .finally(() => { this.inFlightRefreshSessions = null; });
      return this.inFlightRefreshSessions!.then(() => {});
    }
    return Promise.resolve();
  }

}
