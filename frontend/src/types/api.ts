/**
 * API Contract Types matching the ShareLoop Spring Boot backend
 */

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  errors?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements?: number;
}

export interface HealthResponse {
  status: 'UP' | 'DOWN' | 'UNREACHABLE' | string;
  service?: string;
  timestamp?: string;
}
