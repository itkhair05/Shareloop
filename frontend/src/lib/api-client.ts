import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { appConfig } from './config';
import { normalizeApiError } from './api-error';
import { tokenStorage } from './token-storage';

/**
 * Centralized Axios API Client
 * Configured with base URL, timeout, Bearer auth interceptor, and error normalization.
 */
export const rawAxiosClient: AxiosInstance = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

// Request Interceptor: Attach JWT Bearer Token if present
rawAxiosClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getAccessToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // For FormData payloads, remove default Content-Type so Axios/browser sets multipart/form-data with proper boundary
    if (config.data instanceof FormData) {
      if (typeof config.headers?.delete === 'function') {
        config.headers.delete('Content-Type');
      } else if (config.headers) {
        delete config.headers['Content-Type'];
      }
    }
    return config;
  },
  (error) => Promise.reject(normalizeApiError(error))
);

// Response Interceptor: Normalize Errors into ApiError instances and notify on session expiry
rawAxiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = normalizeApiError(error);
    const requestUrl = error?.config?.url || '';
    const isAuthAttempt =
      requestUrl.includes('/api/v1/auth/login') ||
      requestUrl.includes('/api/v1/auth/register');

    if (apiError.isUnauthorized && !isAuthAttempt && unauthorizedHandler) {
      unauthorizedHandler();
    }

    return Promise.reject(apiError);
  }
);

/**
 * Typed HTTP Client Wrapper
 */
export const apiClient = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return rawAxiosClient.get<T, { data: T }>(url, config).then((res) => res.data);
  },

  post<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    return rawAxiosClient.post<T, { data: T }, D>(url, data, config).then((res) => res.data);
  },

  put<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    return rawAxiosClient.put<T, { data: T }, D>(url, data, config).then((res) => res.data);
  },

  patch<T = unknown, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
    return rawAxiosClient.patch<T, { data: T }, D>(url, data, config).then((res) => res.data);
  },

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return rawAxiosClient.delete<T, { data: T }>(url, config).then((res) => res.data);
  },
};

export default apiClient;
