import { EventEmitter } from "events";
import { ControlPlaneEnv, getControlPlaneEnvSync } from "../control-plane/env";
import { IdeSettings } from "../index";

export enum AuthState {
  UNINITIALIZED = "UNINITIALIZED",
  INITIALIZING = "INITIALIZING", 
  AUTHENTICATED = "AUTHENTICATED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  AUTHENTICATION_EXPIRED = "AUTHENTICATION_EXPIRED",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN"
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  email: string;
}

export interface AuthManagerEvents {
  stateChanged: (newState: AuthState, oldState: AuthState) => void;
  sessionUpdated: (session: AuthSession | null) => void;
  authError: (error: Error, retryCount: number) => void;
}

export interface AuthManagerConfig {
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
  tokenCacheExpiryMs: number;
}

const DEFAULT_CONFIG: AuthManagerConfig = {
  maxRetries: 3,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 300000, // 5 minutes
  tokenCacheExpiryMs: 3600000 // 1 hour
};

/**
 * Centralized authentication manager that handles all auth state and operations
 * with proper error handling, retry logic, and circuit breaker pattern.
 */
export class AuthManager extends EventEmitter {
  private state: AuthState = AuthState.UNINITIALIZED;
  private session: AuthSession | null = null;
  private authProvider: any = null;
  private config: AuthManagerConfig;
  private controlPlaneEnv: ControlPlaneEnv;
  
  // Circuit breaker state
  private failureCount = 0;
  private lastFailureTime = 0;
  private circuitBreakerOpenUntil = 0;
  
  // Retry state
  private currentRetryCount = 0;
  private authPromise: Promise<AuthSession | null> | null = null;
  private isInitializing = false;
  
  // Caching
  private tokenCache: Map<string, AuthSession> = new Map();
  
  constructor(
    ideSettings: IdeSettings,
    config: Partial<AuthManagerConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.controlPlaneEnv = getControlPlaneEnvSync(
      'production', // ideSettings.debuggAiTestEnvironment,
      ideSettings.enableControlServerBeta
    );
  }

  /**
   * Reset the auth manager to initial state (useful for testing)
   */
  reset(): void {
    this.state = AuthState.UNINITIALIZED;
    this.session = null;
    this.authProvider = null;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.circuitBreakerOpenUntil = 0;
    this.currentRetryCount = 0;
    this.authPromise = null;
    this.isInitializing = false;
    this.tokenCache.clear();
    this.removeAllListeners();
  }

  /**
   * Initialize the auth manager with an auth provider
   */
  async initialize(authProvider: any): Promise<void> {
    if (this.state !== AuthState.UNINITIALIZED) {
      console.warn("AuthManager already initialized");
      return;
    }

    this.setState(AuthState.INITIALIZING);
    this.authProvider = authProvider;
    this.isInitializing = true;

    try {
      // Try to load cached session first
      await this.loadCachedSession();
      
      if (!this.session) {
        // No cached session, try to get from provider
        await this.refreshAuthSession();
      }
      
      console.log("AuthManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AuthManager:", error);
      this.setState(AuthState.AUTHENTICATION_FAILED);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Get current authentication state
   */
  getState(): AuthState {
    return this.state;
  }

  /**
   * Get current session if authenticated
   */
  getSession(): AuthSession | null {
    if (this.state === AuthState.AUTHENTICATED && this.session) {
      // Check if session is still valid
      if (this.session.expiresAt > Date.now()) {
        return this.session;
      } else {
        // Session expired
        this.setState(AuthState.AUTHENTICATION_EXPIRED);
        return null;
      }
    }
    return null;
  }

  /**
   * Get access token if available
   */
  getAccessToken(): string | null {
    const session = this.getSession();
    return session?.accessToken || null;
  }

  /**
   * Check if currently authenticated with valid session
   */
  isAuthenticated(): boolean {
    return this.state === AuthState.AUTHENTICATED && this.getSession() !== null;
  }

  /**
   * Force refresh authentication session
   */
  async refreshAuthSession(): Promise<AuthSession | null> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      console.log("Circuit breaker is open, skipping auth attempt");
      return null;
    }

    // Return existing promise if auth is already in progress
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.performAuthWithRetry();
    
    try {
      const session = await this.authPromise;
      this.authPromise = null;
      return session;
    } catch (error) {
      this.authPromise = null;
      throw error;
    }
  }

  /**
   * Clear current authentication session
   */
  async clearSession(): Promise<void> {
    if (this.authProvider?.clearSessions) {
      try {
        await this.authProvider.clearSessions();
      } catch (error) {
        console.warn("Failed to clear sessions from provider:", error);
        // Continue with local cleanup even if provider fails
      }
    }
    
    this.session = null;
    this.tokenCache.clear();
    this.setState(AuthState.UNINITIALIZED);
    this.emit('sessionUpdated', null);
  }

  /**
   * Wait for authentication to be available (with timeout)
   */
  async waitForAuth(timeoutMs: number = 10000): Promise<AuthSession | null> {
    if (this.isAuthenticated()) {
      return this.getSession();
    }

    // Check if circuit breaker is already open
    if (this.state === AuthState.CIRCUIT_BREAKER_OPEN) {
      return null;
    }

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.removeListener('stateChanged', onStateChange);
          reject(new Error(`Authentication timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      const onStateChange = (newState: AuthState) => {
        if (resolved) return;
        
        if (newState === AuthState.AUTHENTICATED) {
          resolved = true;
          clearTimeout(timeout);
          this.removeListener('stateChanged', onStateChange);
          resolve(this.getSession());
        } else if (
          newState === AuthState.AUTHENTICATION_FAILED || 
          newState === AuthState.CIRCUIT_BREAKER_OPEN
        ) {
          resolved = true;
          clearTimeout(timeout);
          this.removeListener('stateChanged', onStateChange);
          resolve(null);
        }
      };

      this.on('stateChanged', onStateChange);
      
      // Try to refresh if not already trying and if auth is needed
      if (this.state === AuthState.UNINITIALIZED || this.state === AuthState.AUTHENTICATION_EXPIRED) {
        this.refreshAuthSession().catch((error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.removeListener('stateChanged', onStateChange);
            resolve(null);
          }
        });
      }
    });
  }

  // Private methods

  private async performAuthWithRetry(): Promise<AuthSession | null> {
    this.currentRetryCount = 0;

    while (this.currentRetryCount <= this.config.maxRetries) {
      try {
        const session = await this.performAuth();
        
        if (session) {
          // Success - reset failure tracking
          this.failureCount = 0;
          this.currentRetryCount = 0;
          this.setSession(session);
          this.setState(AuthState.AUTHENTICATED);
          return session;
        }
      } catch (error) {
        this.handleAuthError(error as Error);
        
        // Check if circuit breaker opened during error handling
        if (this.state === AuthState.CIRCUIT_BREAKER_OPEN) {
          return null; // Don't continue retrying if circuit breaker is open
        }
        
        if (this.currentRetryCount < this.config.maxRetries) {
          const delay = this.calculateRetryDelay();
          console.log(`Auth attempt ${this.currentRetryCount + 1} failed, retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
      
      this.currentRetryCount++;
    }

    // All retries failed, handle accordingly
    this.handleRefreshSessionFailure();
    
    // Only set to failed if circuit breaker didn't open
    if (this.state !== AuthState.CIRCUIT_BREAKER_OPEN) {
      this.handleMaxRetriesExceeded();
    }
    return null;
  }

  private async performAuth(): Promise<AuthSession | null> {
    if (!this.authProvider) {
      throw new Error("Auth provider not initialized");
    }

    // Try to get sessions from provider
    const sessions = await this.authProvider.getSessions();
    
    if (sessions.length === 0) {
      throw new Error("No auth sessions available");
    }

    const session = sessions[0];
    if (!session.accessToken) {
      throw new Error("No access token in session");
    }

    // Convert to our session format
    let expiresAt = session.expiresAt;
    // Handle invalid expiry dates by checking if it's a valid number
    // Note: negative numbers are valid timestamps (dates before 1970), so we don't exclude them
    if (typeof expiresAt !== 'number' || isNaN(expiresAt)) {
      expiresAt = Date.now() + this.config.tokenCacheExpiryMs;
    }
    
    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: expiresAt,
      userId: session.account?.id || '',
      email: session.account?.label || session.account?.id || ''
    };
  }

  private handleAuthError(error: Error): void {
    this.emit('authError', error, this.currentRetryCount);
  }

  private handleRefreshSessionFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // Check if we should open circuit breaker (but not during initialization)
    if (!this.isInitializing && this.failureCount >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }
  }

  private handleMaxRetriesExceeded(): void {
    console.error(`Auth failed after ${this.config.maxRetries} retries`);
    this.setState(AuthState.AUTHENTICATION_FAILED);
  }

  private openCircuitBreaker(): void {
    console.warn("Opening circuit breaker due to repeated auth failures");
    this.circuitBreakerOpenUntil = Date.now() + this.config.circuitBreakerTimeoutMs;
    this.setState(AuthState.CIRCUIT_BREAKER_OPEN);
  }

  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerOpenUntil > Date.now()) {
      return true;
    }
    
    // Circuit breaker timeout expired, reset
    if (this.state === AuthState.CIRCUIT_BREAKER_OPEN) {
      this.failureCount = 0;
      this.setState(AuthState.UNINITIALIZED);
    }
    
    return false;
  }

  private calculateRetryDelay(): number {
    const exponentialDelay = this.config.baseRetryDelayMs * Math.pow(2, this.currentRetryCount);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, this.config.maxRetryDelayMs);
  }

  private setState(newState: AuthState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`Auth state changed: ${oldState} -> ${newState}`);
    this.emit('stateChanged', newState, oldState);
  }

  private setSession(session: AuthSession): void {
    this.session = session;
    
    // Cache the session
    this.tokenCache.set(session.userId, session);
    
    this.emit('sessionUpdated', session);
  }

  private async loadCachedSession(): Promise<void> {
    // In a real implementation, this would load from secure storage
    // For now, we'll skip caching implementation
    console.log("Loading cached session (not implemented)");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 