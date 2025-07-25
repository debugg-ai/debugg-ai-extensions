import { EventEmitter } from "events";
import * as fs from "fs";

import { ConfigValidationError } from "@continuedev/config-yaml";
import { AuthManager, AuthState } from "../auth/AuthManager";
import { IDE, IdeInfo, IdeSettings, SerializedDebuggAiConfig } from "../index";
import { getConfigJsonPath } from "../util/paths";
import { defaultConfig } from "./default";

export interface ConfigSource {
  type: 'local' | 'remote' | 'default';
  priority: number;
  isAvailable: boolean;
}

export interface ConfigLoadResult {
  config: SerializedDebuggAiConfig;
  source: ConfigSource;
  errors: ConfigValidationError[];
  authRequired: boolean;
}

export enum ConfigLoadState {
  UNINITIALIZED = "UNINITIALIZED",
  LOADING = "LOADING",
  LOADED = "LOADED",
  FAILED = "FAILED"
}

/**
 * Decoupled config loader that can work independently of auth state
 * Provides proper fallbacks and doesn't cascade auth failures
 */
export class ConfigLoader extends EventEmitter {
  private state: ConfigLoadState = ConfigLoadState.UNINITIALIZED;
  private currentConfig: SerializedDebuggAiConfig | null = null;
  private configSources: ConfigSource[] = [];
  private loadPromise: Promise<ConfigLoadResult> | null = null;
  
  constructor(
    private readonly ide: IDE,
    private readonly ideSettings: IdeSettings,
    private readonly ideInfo: IdeInfo,
    private readonly authManager: AuthManager,
    private readonly writeLog: (log: string) => Promise<void>
  ) {
    super();
    this.initializeConfigSources();
  }

  /**
   * Load configuration with fallback strategy
   */
  async loadConfig(forceReload: boolean = false): Promise<ConfigLoadResult> {
    if (this.loadPromise && !forceReload) {
      return this.loadPromise;
    }

    this.setState(ConfigLoadState.LOADING);
    
    this.loadPromise = this.performConfigLoad();
    
    try {
      const result = await this.loadPromise;
      this.currentConfig = result.config;
      this.setState(ConfigLoadState.LOADED);
      this.emit('configLoaded', result);
      return result;
    } catch (error) {
      this.setState(ConfigLoadState.FAILED);
      this.emit('configLoadError', error);
      throw error;
    } finally {
      this.loadPromise = null;
    }
  }

  /**
   * Get current configuration without triggering a reload
   */
  getCurrentConfig(): SerializedDebuggAiConfig | null {
    return this.currentConfig;
  }

  /**
   * Get configuration loading state
   */
  getState(): ConfigLoadState {
    return this.state;
  }

  /**
   * Check if auth is required for remote config
   */
  isAuthRequired(): boolean {
    return this.configSources.some(source => 
      source.type === 'remote' && source.priority > 0
    );
  }

  // Private methods

  private async performConfigLoad(): Promise<ConfigLoadResult> {
    const errors: ConfigValidationError[] = [];
    let finalConfig: SerializedDebuggAiConfig | null = null;
    let sourceUsed: ConfigSource | null = null;

    // Sort sources by priority (highest first)
    const sortedSources = [...this.configSources].sort((a, b) => b.priority - a.priority);

    for (const source of sortedSources) {
      try {
        console.log(`Attempting to load config from ${source.type} source`);
        
        const result = await this.loadFromSource(source);
        if (result.config) {
          finalConfig = result.config;
          sourceUsed = source;
          errors.push(...result.errors);
          break; // Use the first successful source
        }
      } catch (error) {
        console.warn(`Failed to load from ${source.type} source:`, error);
        errors.push({
          fatal: false,
          message: `Failed to load from ${source.type}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    // If all sources failed, use default config
    if (!finalConfig || !sourceUsed) {
      console.log("All config sources failed, using default config");
      finalConfig = defaultConfig as unknown as SerializedDebuggAiConfig;
      sourceUsed = { type: 'default', priority: 0, isAvailable: true };
    }

    return {
      config: finalConfig,
      source: sourceUsed,
      errors,
      authRequired: this.isAuthRequired()
    };
  }

  private async loadFromSource(source: ConfigSource): Promise<{
    config: SerializedDebuggAiConfig | null;
    errors: ConfigValidationError[];
  }> {
    switch (source.type) {
      case 'local':
        return this.loadLocalConfig();
      case 'remote':
        return this.loadRemoteConfig();
      case 'default':
        return this.loadDefaultConfig();
      default:
        throw new Error(`Unknown config source type: ${(source as any).type}`);
    }
  }

  private async loadLocalConfig(): Promise<{
    config: SerializedDebuggAiConfig | null;
    errors: ConfigValidationError[];
  }> {
    const configPath = getConfigJsonPath(this.ideInfo.ideType);
    const errors: ConfigValidationError[] = [];

    try {
      if (!fs.existsSync(configPath)) {
        console.log("Local config file does not exist");
        return { config: null, errors };
      }

      const content = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(content) as SerializedDebuggAiConfig;
      
      console.log("Successfully loaded local config");
      return { config, errors };
    } catch (error) {
      console.error("Failed to load local config:", error);
      errors.push({
        fatal: false,
        message: `Failed to parse local config: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { config: null, errors };
    }
  }

  private async loadRemoteConfig(): Promise<{
    config: SerializedDebuggAiConfig | null;
    errors: ConfigValidationError[];
  }> {
    const errors: ConfigValidationError[] = [];

    try {
      // Check if auth is available (but don't wait indefinitely)
      const authSession = await this.authManager.waitForAuth(5000).catch(() => null);
      
      if (!authSession) {
        console.log("Auth not available for remote config, skipping");
        return { config: null, errors };
      }

      console.log("Auth available, attempting to load remote config");
      
      // Try to load from the debugg AI server
      const config = await this.loadFromDebuggAIServer(authSession.accessToken);
      
      if (config) {
        console.log("Successfully loaded remote config");
        return { config, errors };
      } else {
        throw new Error("Remote config was empty or invalid");
      }
    } catch (error) {
      console.warn("Failed to load remote config:", error);
      errors.push({
        fatal: false,
        message: `Failed to load remote config: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      return { config: null, errors };
    }
  }

  private async loadDefaultConfig(): Promise<{
    config: SerializedDebuggAiConfig | null;
    errors: ConfigValidationError[];
  }> {
    console.log("Loading default config");
    return {
      config: defaultConfig as unknown as SerializedDebuggAiConfig,
      errors: []
    };
  }

  private async loadFromDebuggAIServer(accessToken: string): Promise<SerializedDebuggAiConfig | null> {
    // This would normally use the DebuggAIServerClient, but we want to avoid
    // the circular dependency issues. Instead, we'll make a direct API call.
    
    // For now, return null to fall back to other sources
    // TODO: Implement direct API call to avoid circular dependency
    console.log("Direct API call to DebuggAI server not yet implemented");
    return null;
  }

  private initializeConfigSources(): void {
    this.configSources = [
      {
        type: 'local',
        priority: 10, // Highest priority
        isAvailable: true
      },
      {
        type: 'remote',
        priority: 5,  // Medium priority
        isAvailable: false // Will be determined by auth state
      },
      {
        type: 'default',
        priority: 1,  // Lowest priority (fallback)
        isAvailable: true
      }
    ];

    // Update remote source availability based on auth state
    this.authManager.on('stateChanged', (newState: AuthState) => {
      const remoteSource = this.configSources.find(s => s.type === 'remote');
      if (remoteSource) {
        remoteSource.isAvailable = newState === AuthState.AUTHENTICATED;
      }
    });
  }

  private setState(newState: ConfigLoadState): void {
    const oldState = this.state;
    this.state = newState;
    console.log(`Config load state changed: ${oldState} -> ${newState}`);
    this.emit('stateChanged', newState, oldState);
  }
} 