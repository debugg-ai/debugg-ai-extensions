// utils/axiosTransport.ts
import axios from "axios";

import {
    objToCamelCase,
    objToSnakeCase,
} from "../../util/objectNaming";

import type {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
} from "axios";
  
  /** Constructor options that come from the top‑level client */
  export interface AxiosTransportOptions {
    baseUrl: string;
    token?: string;
    /** You can pass a pre‑configured axios instance (e.g. for tests) */
    instance?: AxiosInstance;
  }
  
  /**
   * A tiny wrapper around axios that keeps all your interceptors
   * but gives service factories a clean, typed surface.
   */
  export class AxiosTransport {
    protected readonly axios: AxiosInstance;
    private instanceId: string = Math.random().toString(36).substring(7);
    public onAuthFailure?: () => void;
  
    constructor({ baseUrl, token, instance }: AxiosTransportOptions) {
      // Use an injected instance or create one that mimics `axiosServices`
      this.axios =
        instance ??
        axios.create({
          baseURL: baseUrl.replace(/\/+$/, "/"),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      
      console.log(`AxiosTransport created with baseURL: ${this.axios.defaults.baseURL}, instanceId: ${this.instanceId}`);
      console.log(`Initial headers:`, this.axios.defaults.headers.common);
  
      /* ---------- INTERCEPTORS ---------- */
      // Response → camelCase
      this.axios.interceptors.response.use(
        (res: AxiosResponse) => {
          res.data = objToCamelCase(res.data);
          return res;
        },
        (err) =>
          Promise.reject(
            (err.response && err.response.data) || "Unknown Axios error",
          ),
      );
  
      // Request → snake_case
      this.axios.interceptors.request.use((cfg) => {
        console.log(`Request interceptor - URL: ${cfg.url}, Method: ${cfg.method}, instanceId: ${this.instanceId}`);
        console.log(`Request headers:`, cfg.headers);
        console.log(`Request Authorization:`, cfg.headers?.Authorization);
        
        if (cfg.data && typeof cfg.data === "object") {
          cfg.data = objToSnakeCase(cfg.data);
        }
        if (cfg.params && typeof cfg.params === "object") {
          cfg.params = objToSnakeCase(cfg.params);
        }
        return cfg;
      });

      // Response interceptor to handle authentication failures
      this.axios.interceptors.response.use(
        (response) => response,
        async (error) => {
          if (error.response?.status === 401 && error.response?.data?.detail === 'Authentication credentials were not provided.') {
            console.log(`Authentication failed for request to ${error.config?.url}, attempting token refresh...`);
            // Signal that token refresh is needed
            this.onAuthFailure?.();
          }
          return Promise.reject(error);
        }
      );
    }
  
    /* ---------- SHORTHAND METHODS ---------- */
    async request<T = unknown>(
      cfg: AxiosRequestConfig,
    ): Promise<T> {
      const res = await this.axios.request<T>(cfg);
      return res.data;
    }
  
    get<T = unknown>(url: string, params?: any) {
      return this.request<T>({ url, method: "GET", params });
    }
  
    post<T = unknown>(url: string, data?: any, cfg?: AxiosRequestConfig) {
      return this.request<T>({ url, method: "POST", data, ...cfg });
    }
  
    put<T = unknown>(url: string, data?: any, cfg?: AxiosRequestConfig) {
      return this.request<T>({ url, method: "PUT", data, ...cfg });
    }
  
    delete<T = unknown>(url: string, cfg?: AxiosRequestConfig) {
      return this.request<T>({ url, method: "DELETE", ...cfg });
    }

    /**
     * Update the authorization token for this transport instance.
     */
    updateToken(token: string): void {
      console.log(`AxiosTransport.updateToken called with token: ${token.substring(0, 10)}..., instanceId: ${this.instanceId}`);
      if (this.axios) {
        console.log(`Before update - Authorization header: ${this.axios.defaults.headers.common['Authorization']}`);
        this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Also update the instance headers directly
        this.axios.defaults.headers['Authorization'] = `Bearer ${token}`;
        console.log(`After update - Authorization header: ${this.axios.defaults.headers.common['Authorization']}`);
        console.log(`Updated Authorization header to: Bearer ${token.substring(0, 10)}...`);
        console.log(`Current headers:`, this.axios.defaults.headers.common);
      } else {
        console.warn('Axios instance not available for token update');
      }
    }

    /**
     * Get the current authorization header for debugging.
     */
    getAuthorizationHeader(): string | undefined {
      return this.axios?.defaults.headers.common['Authorization'] as string | undefined;
    }
  }
  