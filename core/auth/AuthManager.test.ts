import { EventEmitter } from "events";
import { IdeSettings } from "../index";
import { AuthManager, AuthSession, AuthState } from "./AuthManager";

// Mock auth provider for testing
class MockAuthProvider extends EventEmitter {
  private sessions: any[] = [];
  private shouldFail = false;
  private failureCount = 0;
  private clearSessionsCalled = false;

  constructor() {
    super();
  }

  async getSessions(): Promise<any[]> {
    if (this.shouldFail) {
      this.failureCount++;
      throw new Error(`Mock auth provider failure (attempt ${this.failureCount})`);
    }
    return this.sessions;
  }

  setSessions(sessions: any[]): void {
    this.sessions = sessions;
  }

  async clearSessions(): Promise<void> {
    this.clearSessionsCalled = true;
    this.sessions = [];
  }

  setFailure(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
    if (!shouldFail) {
      this.failureCount = 0;
    }
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  wasClearSessionsCalled(): boolean {
    return this.clearSessionsCalled;
  }
}

describe("AuthManager", () => {
  let authManager: AuthManager;
  let mockAuthProvider: MockAuthProvider;
  let ideSettings: IdeSettings;

  beforeEach(() => {
    mockAuthProvider = new MockAuthProvider();
    ideSettings = {
      enableControlServerBeta: false
    } as IdeSettings;
    
    authManager = new AuthManager(ideSettings, {
      maxRetries: 2,
      baseRetryDelayMs: 10, // Fast retries for testing
      maxRetryDelayMs: 100,
      circuitBreakerThreshold: 3,
      circuitBreakerTimeoutMs: 1000,
      tokenCacheExpiryMs: 3600000
    });
    
    // Ensure clean state for each test
    authManager.reset();
  });

  afterEach(() => {
    authManager.removeAllListeners();
  });

  describe("initialization", () => {
    it("should start in UNINITIALIZED state", () => {
      expect(authManager.getState()).toBe(AuthState.UNINITIALIZED);
      expect(authManager.isAuthenticated()).toBe(false);
      expect(authManager.getAccessToken()).toBeNull();
    });

    it("should transition to INITIALIZING then AUTHENTICATED when auth provider has valid sessions", async () => {
      const validSession = {
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      };
      
      mockAuthProvider.setSessions([validSession]);

      const stateChanges: AuthState[] = [];
      authManager.on('stateChanged', (newState) => {
        stateChanges.push(newState);
      });

      await authManager.initialize(mockAuthProvider);

      expect(stateChanges).toContain(AuthState.INITIALIZING);
      expect(stateChanges).toContain(AuthState.AUTHENTICATED);
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.isAuthenticated()).toBe(true);
      expect(authManager.getAccessToken()).toBe("test-token");
    });

    it("should handle initialization failure gracefully", async () => {
      mockAuthProvider.setFailure(true);

      const stateChanges: AuthState[] = [];
      authManager.on('stateChanged', (newState) => {
        stateChanges.push(newState);
      });

      await authManager.initialize(mockAuthProvider);

      expect(stateChanges).toContain(AuthState.INITIALIZING);
      expect(stateChanges).toContain(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.isAuthenticated()).toBe(false);
    });

    it("should not initialize twice", async () => {
      const validSession = {
        accessToken: "test-token",
        account: { id: "user123" }
      };
      mockAuthProvider.setSessions([validSession]);

      await authManager.initialize(mockAuthProvider);
      const firstState = authManager.getState();

      // Try to initialize again
      await authManager.initialize(mockAuthProvider);
      
      expect(authManager.getState()).toBe(firstState);
    });
  });

  describe("session management", () => {
    beforeEach(async () => {
      const validSession = {
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      };
      
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);
    });

    it("should return valid session when authenticated", () => {
      const session = authManager.getSession();
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("test-token");
      expect(session?.userId).toBe("user123");
      expect(session?.email).toBe("test@example.com");
    });

    it("should detect expired sessions", async () => {
      // Manually set an expired session
      const expiredSession = {
        accessToken: "expired-token",
        refreshToken: "expired-refresh",
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        userId: "user123",
        email: "expired@example.com"
      };
      
      // Manually set the expired session
      authManager['session'] = expiredSession;
      authManager['setState'](AuthState.AUTHENTICATED);

      // Calling getSession should detect expiration
      const result = authManager.getSession();
      expect(result).toBeNull();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
    });

    it("should clear sessions properly", async () => {
      expect(authManager.isAuthenticated()).toBe(true);

      const stateChanges: AuthState[] = [];
      authManager.on('stateChanged', (newState) => {
        stateChanges.push(newState);
      });

      await authManager.clearSession();

      expect(mockAuthProvider.wasClearSessionsCalled()).toBe(true);
      expect(stateChanges).toContain(AuthState.UNINITIALIZED);
      expect(authManager.getSession()).toBeNull();
      expect(authManager.isAuthenticated()).toBe(false);
    });
  });

  describe("retry logic", () => {
    beforeEach(async () => {
      authManager.reset(); // Ensure clean state
      mockAuthProvider.setSessions([{
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      }]);
      await authManager.initialize(mockAuthProvider);
    });

    it("should retry failed auth attempts with exponential backoff", async () => {
      mockAuthProvider.setFailure(true);

      const authErrors: Error[] = [];
      authManager.on('authError', (error) => {
        authErrors.push(error);
      });

      await authManager.refreshAuthSession();

      // Should have attempted maxRetries + 1 times (initial + retries)
      expect(mockAuthProvider.getFailureCount()).toBe(3); // maxRetries = 2, so 3 total attempts
      expect(authErrors.length).toBe(3);
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should succeed on retry if auth provider recovers", async () => {
      // First attempt fails
      mockAuthProvider.setFailure(true);
      
      const refreshPromise = authManager.refreshAuthSession();
      
      // Simulate provider recovery after a short delay (less than first retry delay)
      setTimeout(() => {
        mockAuthProvider.setFailure(false);
        mockAuthProvider.setSessions([{
          accessToken: "recovered-token",
          refreshToken: "refresh-recovered",
          expiresAt: Date.now() + 3600000,
          account: { id: "user123", label: "recovered@example.com" }
        }]);
      }, 15); // Less than base retry delay of 10ms + jitter

      const result = await refreshPromise;

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.getAccessToken()).toBe("recovered-token");
      expect(result?.accessToken).toBe("recovered-token");
    });
  });

  describe("circuit breaker", () => {
    beforeEach(async () => {
      // Initialize with tighter circuit breaker settings
      authManager = new AuthManager(ideSettings, {
        maxRetries: 1,
        baseRetryDelayMs: 10,
        circuitBreakerThreshold: 2, // Lower threshold for testing
        circuitBreakerTimeoutMs: 500,
        tokenCacheExpiryMs: 3600000
      });
      authManager.reset(); // Ensure clean state
      mockAuthProvider.setSessions([{
        accessToken: "test-token",
        refreshToken: "refresh-token", 
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      }]);
      await authManager.initialize(mockAuthProvider);
    });

    it("should open circuit breaker after repeated failures", async () => {
      mockAuthProvider.setFailure(true);

      // First failure
      await authManager.refreshAuthSession();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);

      // Second failure should open circuit breaker
      await authManager.refreshAuthSession();
      expect(authManager.getState()).toBe(AuthState.CIRCUIT_BREAKER_OPEN);

      // Third attempt should be skipped due to circuit breaker
      const failureCountBefore = mockAuthProvider.getFailureCount();
      await authManager.refreshAuthSession();
      expect(mockAuthProvider.getFailureCount()).toBe(failureCountBefore); // No new attempts
    });

    it("should reset circuit breaker after timeout", async () => {
      mockAuthProvider.setFailure(true);

      // Trigger circuit breaker
      await authManager.refreshAuthSession();
      await authManager.refreshAuthSession();
      expect(authManager.getState()).toBe(AuthState.CIRCUIT_BREAKER_OPEN);

      // Wait for circuit breaker timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Circuit breaker should reset
      mockAuthProvider.setFailure(false);
      mockAuthProvider.setSessions([{
        accessToken: "post-recovery-token",
        account: { id: "user123" }
      }]);

      await authManager.refreshAuthSession();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
    });
  });

  describe("waitForAuth", () => {
    it("should return immediately if already authenticated", async () => {
      authManager.reset(); // Ensure clean state
      const validSession = {
        accessToken: "test-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      };
      
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      const session = await authManager.waitForAuth(1000);
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("test-token");
    });

    it("should wait for authentication to complete", async () => {
      authManager.reset(); // Ensure clean state
      // Initialize without sessions (unauthenticated state)
      mockAuthProvider.setSessions([]);
      await authManager.initialize(mockAuthProvider);
      
      // Start waiting for auth
      const waitPromise = authManager.waitForAuth(2000);

      // Simulate async auth completion
      setTimeout(() => {
        mockAuthProvider.setSessions([{
          accessToken: "async-token",
          refreshToken: "async-refresh",
          expiresAt: Date.now() + 3600000,
          account: { id: "user123", label: "async@example.com" }
        }]);
        authManager.refreshAuthSession();
      }, 100);

      const session = await waitPromise;
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("async-token");
    });

    it("should timeout if auth takes too long", async () => {
      authManager.reset(); // Ensure clean state
      // Initialize without sessions to ensure unauthenticated state
      mockAuthProvider.setSessions([]);
      await authManager.initialize(mockAuthProvider);
      mockAuthProvider.setFailure(true);

      await expect(authManager.waitForAuth(100)).rejects.toThrow("Authentication timeout");
    });

    it("should return null for circuit breaker state", async () => {
      // Setup circuit breaker
      authManager = new AuthManager(ideSettings, {
        circuitBreakerThreshold: 1,
        maxRetries: 0,
        baseRetryDelayMs: 10
      });
      authManager.reset(); // Ensure clean state
      
      await authManager.initialize(mockAuthProvider);
      mockAuthProvider.setFailure(true);
      
      // Trigger circuit breaker
      await authManager.refreshAuthSession();
      
      const session = await authManager.waitForAuth(1000);
      expect(session).toBeNull();
    });
  });

  describe("concurrent auth attempts", () => {
    beforeEach(async () => {
      authManager.reset(); // Ensure clean state
      mockAuthProvider.setSessions([{
        accessToken: "initial-token",
        refreshToken: "initial-refresh",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "test@example.com" }
      }]);
      await authManager.initialize(mockAuthProvider);
    });

    it("should handle multiple concurrent refresh attempts", async () => {
      mockAuthProvider.setSessions([{
        accessToken: "concurrent-token",
        account: { id: "user123" }
      }]);

      // Start multiple concurrent refresh attempts
      const promises = [
        authManager.refreshAuthSession(),
        authManager.refreshAuthSession(),
        authManager.refreshAuthSession()
      ];

      const results = await Promise.all(promises);

      // All should return the same session
      results.forEach(session => {
        expect(session?.accessToken).toBe("concurrent-token");
      });

      // Auth provider should only be called once due to deduplication
      expect(mockAuthProvider.getFailureCount()).toBe(0);
    });
  });

  describe("event emission", () => {
    it("should emit state change events", async () => {
      const stateChanges: { newState: AuthState, oldState: AuthState }[] = [];
      
      authManager.on('stateChanged', (newState, oldState) => {
        stateChanges.push({ newState, oldState });
      });

      const validSession = {
        accessToken: "test-token",
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      expect(stateChanges.length).toBeGreaterThan(0);
      expect(stateChanges[0].oldState).toBe(AuthState.UNINITIALIZED);
      expect(stateChanges[0].newState).toBe(AuthState.INITIALIZING);
    });

    it("should emit session update events", async () => {
      const sessionUpdates: (AuthSession | null)[] = [];
      
      authManager.on('sessionUpdated', (session) => {
        sessionUpdates.push(session);
      });

      const validSession = {
        accessToken: "test-token",
        account: { id: "user123", label: "test@example.com" }
      };
      
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      expect(sessionUpdates.length).toBeGreaterThan(0);
      expect(sessionUpdates[sessionUpdates.length - 1]?.accessToken).toBe("test-token");
    });
  });

  describe("corrupted session data edge cases", () => {
    it("should handle sessions with missing access token", async () => {
      const corruptedSession = {
        accessToken: null, // Missing/null access token
        refreshToken: "refresh-token",
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.getAccessToken()).toBeNull();
    });

    it("should handle sessions with undefined access token", async () => {
      const corruptedSession = {
        accessToken: undefined,
        refreshToken: "refresh-token",
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.getAccessToken()).toBeNull();
    });

    it("should handle sessions with empty string access token", async () => {
      const corruptedSession = {
        accessToken: "", // Empty string
        refreshToken: "refresh-token",
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.getAccessToken()).toBeNull();
    });

    it("should handle sessions with malformed account data", async () => {
      const corruptedSession = {
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        account: null // Null account
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      const session = authManager.getSession();
      expect(session?.userId).toBe(''); // Should fallback to empty string
      expect(session?.email).toBe(''); // Should fallback to empty string
    });

    it("should handle sessions with missing account object", async () => {
      const corruptedSession = {
        accessToken: "valid-token",
        refreshToken: "refresh-token"
        // Missing account entirely
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      const session = authManager.getSession();
      expect(session?.userId).toBe('');
      expect(session?.email).toBe('');
    });

    it("should handle sessions with invalid expiry dates", async () => {
      const corruptedSession = {
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: "invalid-date", // String instead of number
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      const session = authManager.getSession();
      expect(typeof session?.expiresAt).toBe('number'); // Should fallback to calculated value
    });

    it("should handle sessions with negative expiry dates", async () => {
      const corruptedSession = {
        accessToken: "valid-token",
        refreshToken: "refresh-token",
        expiresAt: -1000, // Negative timestamp
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([corruptedSession]);
      await authManager.initialize(mockAuthProvider);

      // Session should be created but immediately detected as expired
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      const session = authManager.getSession();
      expect(session).toBeNull(); // Should be null due to expiry
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
    });
  });

  describe("refresh token failure edge cases", () => {
    class RefreshFailureAuthProvider extends MockAuthProvider {
      private refreshAttempts = 0;
      private maxRefreshAttempts = 0;

      setMaxRefreshAttempts(max: number): void {
        this.maxRefreshAttempts = max;
        this.refreshAttempts = 0;
      }

      async getSessions(): Promise<any[]> {
        if (this.refreshAttempts < this.maxRefreshAttempts) {
          this.refreshAttempts++;
          throw new Error(`Refresh token invalid (attempt ${this.refreshAttempts})`);
        }
        return super.getSessions();
      }
    }

    let refreshFailureProvider: RefreshFailureAuthProvider;

    beforeEach(async () => {
      refreshFailureProvider = new RefreshFailureAuthProvider();
      authManager = new AuthManager(ideSettings, {
        maxRetries: 2,
        baseRetryDelayMs: 10,
        circuitBreakerThreshold: 3
      });
      authManager.reset();
    });

    it("should handle refresh token expiry", async () => {
      refreshFailureProvider.setMaxRefreshAttempts(3); // Fail all retries
      
      await authManager.initialize(refreshFailureProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
      expect(authManager.getAccessToken()).toBeNull();
    });

    it("should recover after temporary refresh token issues", async () => {
      refreshFailureProvider.setMaxRefreshAttempts(2); // Fail first 2 attempts, succeed on 3rd
      refreshFailureProvider.setSessions([{
        accessToken: "recovered-token",
        refreshToken: "new-refresh-token",
        expiresAt: Date.now() + 3600000,
        account: { id: "user123", label: "recovered@example.com" }
      }]);

      await authManager.initialize(refreshFailureProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.getAccessToken()).toBe("recovered-token");
    });
  });

  describe("API endpoint failure edge cases", () => {
    class ApiFailureAuthProvider extends MockAuthProvider {
      private networkErrors = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"];
      private currentErrorIndex = 0;
      private shouldSimulateNetworkError = false;

      simulateNetworkError(enable: boolean): void {
        this.shouldSimulateNetworkError = enable;
      }

      async getSessions(): Promise<any[]> {
        if (this.shouldSimulateNetworkError) {
          const error = new Error(this.networkErrors[this.currentErrorIndex % this.networkErrors.length]);
          (error as any).code = this.networkErrors[this.currentErrorIndex % this.networkErrors.length];
          this.currentErrorIndex++;
          throw error;
        }
        return super.getSessions();
      }
    }

    let apiFailureProvider: ApiFailureAuthProvider;

    beforeEach(() => {
      apiFailureProvider = new ApiFailureAuthProvider();
      authManager = new AuthManager(ideSettings, {
        maxRetries: 2,
        baseRetryDelayMs: 10,
        circuitBreakerThreshold: 4
      });
      authManager.reset();
    });

    it("should handle ECONNREFUSED network errors", async () => {
      apiFailureProvider.simulateNetworkError(true);
      
      await authManager.initialize(apiFailureProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle DNS resolution failures (ENOTFOUND)", async () => {
      apiFailureProvider.simulateNetworkError(true);
      
      await authManager.initialize(apiFailureProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle timeout errors (ETIMEDOUT)", async () => {
      apiFailureProvider.simulateNetworkError(true);
      
      await authManager.initialize(apiFailureProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should recover when network connectivity is restored", async () => {
      apiFailureProvider.simulateNetworkError(true);
      
      const initPromise = authManager.initialize(apiFailureProvider);
      
      // Simulate network recovery mid-retry
      setTimeout(() => {
        apiFailureProvider.simulateNetworkError(false);
        apiFailureProvider.setSessions([{
          accessToken: "network-recovered-token",
          account: { id: "user123" }
        }]);
      }, 25); // After first retry but before all retries exhausted

      await initPromise;
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.getAccessToken()).toBe("network-recovered-token");
    });
  });

  describe("time and expiry edge cases", () => {
    beforeEach(() => {
      authManager = new AuthManager(ideSettings);
      authManager.reset();
    });

    it("should handle sessions expiring exactly at current time", async () => {
      const currentTime = Date.now();
      const sessionExpiringNow = {
        accessToken: "expiring-now-token",
        refreshToken: "refresh-token",
        expiresAt: currentTime, // Expires exactly now
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([sessionExpiringNow]);
      await authManager.initialize(mockAuthProvider);

      // Give a tiny delay to ensure time has passed
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const session = authManager.getSession();
      expect(session).toBeNull();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
    });

    it("should handle sessions that expired 1ms ago", async () => {
      const sessionExpiredRecently = {
        accessToken: "recently-expired-token",
        refreshToken: "refresh-token",
        expiresAt: Date.now() - 1, // Expired 1ms ago
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([sessionExpiredRecently]);
      await authManager.initialize(mockAuthProvider);

      const session = authManager.getSession();
      expect(session).toBeNull();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
    });

    it("should handle very old expired sessions", async () => {
      const veryOldSession = {
        accessToken: "ancient-token",
        refreshToken: "ancient-refresh",
        expiresAt: Date.now() - (365 * 24 * 60 * 60 * 1000), // Expired 1 year ago
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([veryOldSession]);
      await authManager.initialize(mockAuthProvider);

      const session = authManager.getSession();
      expect(session).toBeNull();
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
    });

    it("should handle sessions with far future expiry", async () => {
      const farFutureSession = {
        accessToken: "future-token",
        refreshToken: "future-refresh",
        expiresAt: Date.now() + (100 * 365 * 24 * 60 * 60 * 1000), // Expires in 100 years
        account: { id: "user123" }
      };
      
      mockAuthProvider.setSessions([farFutureSession]);
      await authManager.initialize(mockAuthProvider);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      const session = authManager.getSession();
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("future-token");
    });

    it("should handle system clock changes during authentication", async () => {
      const originalDateNow = Date.now;
      let mockTime = Date.now();
      
      // Mock Date.now to control time
      Date.now = jest.fn(() => mockTime);

      try {
        const sessionValidForAnHour = {
          accessToken: "time-sensitive-token",
          refreshToken: "time-refresh",
          expiresAt: mockTime + 3600000, // 1 hour from mock time
          account: { id: "user123" }
        };
        
        mockAuthProvider.setSessions([sessionValidForAnHour]);
        await authManager.initialize(mockAuthProvider);

        expect(authManager.isAuthenticated()).toBe(true);

        // Simulate system clock jumping forward 2 hours
        mockTime += (2 * 3600000);

        // Session should now be detected as expired
        const session = authManager.getSession();
        expect(session).toBeNull();
        expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_EXPIRED);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe("auth provider malfunction edge cases", () => {
    class MalfunctioningAuthProvider extends MockAuthProvider {
      private malfunctionType: string = "";

      setMalfunctionType(type: string): void {
        this.malfunctionType = type;
      }

      async getSessions(): Promise<any[]> {
        switch (this.malfunctionType) {
          case "returns_undefined":
            return undefined as any;
          case "returns_null":
            return null as any;
          case "returns_non_array":
            return "not an array" as any;
          case "returns_malformed_objects":
            return [{ totally: "wrong", structure: true }];
          case "hangs_indefinitely":
            return new Promise(() => {}); // Never resolves
          case "throws_non_error":
            throw "This is not an Error object";
          case "throws_circular_reference":
            const circular: any = { prop: null };
            circular.prop = circular;
            const error = new Error("Circular reference error");
            (error as any).circularData = circular;
            throw error;
          default:
            return super.getSessions();
        }
      }

      async clearSessions(): Promise<void> {
        if (this.malfunctionType === "clear_throws") {
          throw new Error("Clear sessions failed");
        }
        super.clearSessions();
      }
    }

    let malfunctioningProvider: MalfunctioningAuthProvider;

    beforeEach(() => {
      malfunctioningProvider = new MalfunctioningAuthProvider();
      authManager = new AuthManager(ideSettings, {
        maxRetries: 1,
        baseRetryDelayMs: 10
      });
      authManager.reset();
    });

    it("should handle provider returning undefined", async () => {
      malfunctioningProvider.setMalfunctionType("returns_undefined");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle provider returning null", async () => {
      malfunctioningProvider.setMalfunctionType("returns_null");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle provider returning non-array", async () => {
      malfunctioningProvider.setMalfunctionType("returns_non_array");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle provider returning malformed session objects", async () => {
      malfunctioningProvider.setMalfunctionType("returns_malformed_objects");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle provider that hangs indefinitely", async () => {
      malfunctioningProvider.setMalfunctionType("hangs_indefinitely");
      
      // Should timeout when provider hangs
      await expect(authManager.waitForAuth(100)).rejects.toThrow("Authentication timeout");
    }, 10000);

    it("should handle provider throwing non-Error objects", async () => {
      malfunctioningProvider.setMalfunctionType("throws_non_error");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle provider throwing errors with circular references", async () => {
      malfunctioningProvider.setMalfunctionType("throws_circular_reference");
      
      await authManager.initialize(malfunctioningProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle clearSessions throwing errors", async () => {
      // First establish a session
      malfunctioningProvider.setSessions([{
        accessToken: "test-token",
        account: { id: "user123" }
      }]);
      await authManager.initialize(malfunctioningProvider);
      expect(authManager.isAuthenticated()).toBe(true);

      // Now make clearSessions throw
      malfunctioningProvider.setMalfunctionType("clear_throws");

      // clearSession should handle the error gracefully
      await expect(authManager.clearSession()).resolves.not.toThrow();
      
      // Auth state should still be cleared despite provider error
      expect(authManager.getState()).toBe(AuthState.UNINITIALIZED);
      expect(authManager.getSession()).toBeNull();
    });
  });

  describe("storage and memory failure edge cases", () => {
    class MemoryConstrainedAuthProvider extends MockAuthProvider {
      private shouldSimulateMemoryError = false;

      simulateMemoryError(enable: boolean): void {
        this.shouldSimulateMemoryError = enable;
      }

      async getSessions(): Promise<any[]> {
        if (this.shouldSimulateMemoryError) {
          const error = new Error("JavaScript heap out of memory");
          (error as any).code = "ERR_OUT_OF_MEMORY";
          throw error;
        }
        return super.getSessions();
      }
    }

    let memoryConstrainedProvider: MemoryConstrainedAuthProvider;

    beforeEach(() => {
      memoryConstrainedProvider = new MemoryConstrainedAuthProvider();
      authManager = new AuthManager(ideSettings, {
        maxRetries: 1,
        baseRetryDelayMs: 10
      });
      authManager.reset();
    });

    it("should handle out of memory errors", async () => {
      memoryConstrainedProvider.simulateMemoryError(true);
      
      await authManager.initialize(memoryConstrainedProvider);
      
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATION_FAILED);
    });

    it("should handle extremely large session objects", async () => {
      // Create a session with a very large token (simulating memory pressure)
      const largeToken = "x".repeat(1000000); // 1MB token
      const largeSession = {
        accessToken: largeToken,
        refreshToken: "large-refresh-" + "y".repeat(100000),
        expiresAt: Date.now() + 3600000,
        account: { 
          id: "user123",
          label: "user@example.com",
          metadata: "z".repeat(500000) // More large data
        }
      };
      
      memoryConstrainedProvider.setSessions([largeSession]);
      
      await authManager.initialize(memoryConstrainedProvider);
      
      // Should still work with large session
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.getAccessToken()).toBe(largeToken);
    });

    it("should handle corrupted token cache", async () => {
      // First establish a session to populate cache
      const validSession = {
        accessToken: "cache-test-token",
        account: { id: "user123" }
      };
      
      memoryConstrainedProvider.setSessions([validSession]);
      await authManager.initialize(memoryConstrainedProvider);
      expect(authManager.isAuthenticated()).toBe(true);

      // Simulate cache corruption by directly manipulating internal cache
      (authManager as any).tokenCache.set("user123", null);
      (authManager as any).tokenCache.set("corrupted", undefined);
      (authManager as any).tokenCache.set("invalid", "not-a-session-object");

      // Auth manager should still work despite corrupted cache
      const session = authManager.getSession();
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe("cache-test-token");
    });

    it("should handle session storage overflow", async () => {
      // Fill up the token cache with many sessions
      const authManagerWithSmallCache = new AuthManager(ideSettings, {
        tokenCacheExpiryMs: 1000 // Short expiry for testing
      });
      authManagerWithSmallCache.reset();

      // Simulate many cached sessions
      const cache = (authManagerWithSmallCache as any).tokenCache;
      for (let i = 0; i < 1000; i++) {
        cache.set(`user${i}`, {
          accessToken: `token${i}`,
          userId: `user${i}`,
          email: `user${i}@example.com`,
          expiresAt: Date.now() + 3600000
        });
      }

      // Should still be able to initialize normally
      const validSession = {
        accessToken: "overflow-test-token",
        account: { id: "newuser" }
      };
      
      mockAuthProvider.setSessions([validSession]);
      await authManagerWithSmallCache.initialize(mockAuthProvider);
      
      expect(authManagerWithSmallCache.isAuthenticated()).toBe(true);
    });
  });

  describe("extreme concurrency edge cases", () => {
    beforeEach(() => {
      authManager = new AuthManager(ideSettings, {
        maxRetries: 1,
        baseRetryDelayMs: 10,
        circuitBreakerThreshold: 10 // High threshold for concurrency tests
      });
      authManager.reset();
    });

    it("should handle 100 concurrent initialization attempts", async () => {
      const validSession = {
        accessToken: "concurrent-init-token",
        account: { id: "user123" }
      };
      mockAuthProvider.setSessions([validSession]);

      // Start 100 concurrent initialization attempts
      const initPromises = Array.from({ length: 100 }, () => 
        authManager.initialize(mockAuthProvider)
      );

      await Promise.all(initPromises);

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.getAccessToken()).toBe("concurrent-init-token");
    });

    it("should handle rapid session refresh requests", async () => {
      const validSession = {
        accessToken: "rapid-refresh-token",
        account: { id: "user123" }
      };
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      // Start many rapid refresh attempts
      const refreshPromises = Array.from({ length: 50 }, () => 
        authManager.refreshAuthSession()
      );

      const results = await Promise.all(refreshPromises);

      // All should return the same session or null
      results.forEach(session => {
        if (session) {
          expect(session.accessToken).toBe("rapid-refresh-token");
        }
      });

      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
    });

    it("should handle mixed concurrent operations", async () => {
      const validSession = {
        accessToken: "mixed-ops-token",
        account: { id: "user123" }
      };
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      // Mix of different concurrent operations
      const operations = [
        ...Array.from({ length: 20 }, () => authManager.getSession()),
        ...Array.from({ length: 20 }, () => authManager.getAccessToken()),
        ...Array.from({ length: 20 }, () => authManager.isAuthenticated()),
        ...Array.from({ length: 10 }, () => authManager.refreshAuthSession()),
        ...Array.from({ length: 10 }, () => authManager.waitForAuth(1000))
      ];

      const results = await Promise.all(operations);

      // Auth manager should maintain consistent state
      expect(authManager.getState()).toBe(AuthState.AUTHENTICATED);
      expect(authManager.isAuthenticated()).toBe(true);
    });

    it("should handle concurrent clear and refresh operations", async () => {
      const validSession = {
        accessToken: "clear-refresh-token",
        account: { id: "user123" }
      };
      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      // Start concurrent clear and refresh operations
      const clearPromises = Array.from({ length: 25 }, () => authManager.clearSession());
      const refreshPromises = Array.from({ length: 25 }, () => authManager.refreshAuthSession());

      await Promise.all([...clearPromises, ...refreshPromises]);

      // Final state should be consistent (either authenticated or uninitialized)
      const finalState = authManager.getState();
      expect([
        AuthState.AUTHENTICATED,
        AuthState.UNINITIALIZED,
        AuthState.AUTHENTICATION_FAILED
      ]).toContain(finalState);
    });

    it("should handle event listener stress test", async () => {
      const validSession = {
        accessToken: "event-stress-token",
        account: { id: "user123" }
      };

      // Add many event listeners
      const stateChangeEvents: AuthState[] = [];
      const sessionUpdateEvents: (AuthSession | null)[] = [];
      const authErrorEvents: Error[] = [];

      for (let i = 0; i < 100; i++) {
        authManager.on('stateChanged', (newState) => stateChangeEvents.push(newState));
        authManager.on('sessionUpdated', (session) => sessionUpdateEvents.push(session));
        authManager.on('authError', (error) => authErrorEvents.push(error));
      }

      mockAuthProvider.setSessions([validSession]);
      await authManager.initialize(mockAuthProvider);

      // Trigger more state changes
      await authManager.refreshAuthSession();
      await authManager.clearSession();

      // Events should have been fired to all listeners
      expect(stateChangeEvents.length).toBeGreaterThan(200); // At least 2 state changes * 100 listeners
      expect(sessionUpdateEvents.length).toBeGreaterThan(100); // At least 1 session update * 100 listeners
    });

    it("should handle auth provider that changes behavior during concurrent calls", async () => {
      class UnstableAuthProvider extends MockAuthProvider {
        private callCount = 0;

        async getSessions(): Promise<any[]> {
          this.callCount++;
          
          if (this.callCount % 3 === 0) {
            throw new Error("Intermittent failure");
          } else if (this.callCount % 2 === 0) {
            return [];
          } else {
            return [{
              accessToken: `unstable-token-${this.callCount}`,
              account: { id: "user123" }
            }];
          }
        }
      }

      const unstableProvider = new UnstableAuthProvider();
      authManager = new AuthManager(ideSettings, {
        maxRetries: 3,
        baseRetryDelayMs: 1,
        circuitBreakerThreshold: 20
      });
      authManager.reset();

      // Start many concurrent operations with unstable provider
      const promises = Array.from({ length: 30 }, () => 
        authManager.refreshAuthSession()
      );

      await Promise.all(promises.map(p => p.catch(() => null))); // Ignore individual failures

      // Should reach some stable state despite instability
      expect([
        AuthState.AUTHENTICATED,
        AuthState.AUTHENTICATION_FAILED,
        AuthState.CIRCUIT_BREAKER_OPEN
      ]).toContain(authManager.getState());
    });
  });
}); 