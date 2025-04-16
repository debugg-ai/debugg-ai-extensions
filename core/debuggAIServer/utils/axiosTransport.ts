// utils/axiosTransport.ts
import type {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
} from "axios";
import axios from "axios";
import {
    objToCamelCase,
    objToSnakeCase,
} from "../../util/objectNaming";
  
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
    private readonly axios: AxiosInstance;
  
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
        if (cfg.data && typeof cfg.data === "object") {
          cfg.data = objToSnakeCase(cfg.data);
        }
        if (cfg.params && typeof cfg.params === "object") {
          cfg.params = objToSnakeCase(cfg.params);
        }
        return cfg;
      });
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
  }
  