import { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api';

/**
 * Normalized application error representing API or network failures.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly path?: string;
  readonly timestamp?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;
  readonly isCanceled: boolean;

  constructor(params: {
    message: string;
    status: number;
    error: string;
    path?: string;
    timestamp?: string;
    fieldErrors?: Record<string, string>;
    isNetworkError?: boolean;
    isTimeout?: boolean;
    isCanceled?: boolean;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.error = params.error;
    this.path = params.path;
    this.timestamp = params.timestamp;
    this.fieldErrors = params.fieldErrors;
    this.isNetworkError = params.isNetworkError ?? false;
    this.isTimeout = params.isTimeout ?? false;
    this.isCanceled = params.isCanceled ?? false;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isValidationError(): boolean {
    return this.status === 400 && Boolean(this.fieldErrors && Object.keys(this.fieldErrors).length > 0);
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }
}

/**
 * Normalizes an unknown error into a strongly-typed ApiError instance.
 */
export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof AxiosError) {
    // Deliberate cancellation is not a network failure and must not be shown
    // to the user as one.
    if (error.code === 'ERR_CANCELED') {
      return new ApiError({
        message: 'Request was canceled',
        status: 0,
        error: 'Canceled',
        isCanceled: true,
      });
    }

    // Network failure (server down, CORS failure, DNS resolution failure)
    if (error.code === 'ERR_NETWORK') {
      return new ApiError({
        message: 'Unable to connect to the ShareLoop server. Please verify your connection or that the backend is running.',
        status: 0,
        error: 'Network Error',
        isNetworkError: true,
      });
    }

    // Request timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new ApiError({
        message: 'Request timed out waiting for server response. Please try again.',
        status: 408,
        error: 'Request Timeout',
        isTimeout: true,
      });
    }

    // Backend ErrorResponse structure returned
    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data as Partial<ApiErrorResponse>;
      const status = error.response.status || data.status || 500;
      const message = data.message || error.message || 'An unexpected server error occurred';
      const errorTitle = data.error || error.response.statusText || 'Error';

      return new ApiError({
        message,
        status,
        error: errorTitle,
        path: data.path,
        timestamp: data.timestamp,
        fieldErrors: data.errors,
      });
    }

    // HTTP response with non-JSON or missing body
    if (error.response) {
      return new ApiError({
        message: error.response.statusText || `HTTP ${error.response.status} Error`,
        status: error.response.status,
        error: error.response.statusText || 'HTTP Error',
      });
    }
  }

  if (error instanceof Error) {
    return new ApiError({
      message: error.message,
      status: 500,
      error: 'Client Error',
    });
  }

  return new ApiError({
    message: 'An unknown error occurred',
    status: 500,
    error: 'Unknown Error',
  });
}
