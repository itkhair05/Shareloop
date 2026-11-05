import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, normalizeApiError } from '../api-error';

describe('ApiError and normalizeApiError', () => {
  it('constructs an ApiError with all fields and properties', () => {
    const error = new ApiError({
      message: 'Validation failed',
      status: 400,
      error: 'Bad Request',
      path: '/api/v1/auth/register',
      timestamp: '2026-10-22T07:00:00Z',
      fieldErrors: { email: 'Invalid format' },
    });

    expect(error.message).toBe('Validation failed');
    expect(error.status).toBe(400);
    expect(error.error).toBe('Bad Request');
    expect(error.path).toBe('/api/v1/auth/register');
    expect(error.fieldErrors).toEqual({ email: 'Invalid format' });
    expect(error.isValidationError).toBe(true);
    expect(error.isUnauthorized).toBe(false);
    expect(error.isForbidden).toBe(false);
    expect(error.isNotFound).toBe(false);
    expect(error.isServerError).toBe(false);
  });

  it('correctly reports HTTP status flag helpers', () => {
    const unauth = new ApiError({ message: 'Unauthorized', status: 401, error: 'Unauthorized' });
    expect(unauth.isUnauthorized).toBe(true);

    const forbidden = new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' });
    expect(forbidden.isForbidden).toBe(true);

    const notFound = new ApiError({ message: 'Not Found', status: 404, error: 'Not Found' });
    expect(notFound.isNotFound).toBe(true);

    const serverErr = new ApiError({ message: 'Internal', status: 500, error: 'Internal Server Error' });
    expect(serverErr.isServerError).toBe(true);
  });

  it('normalizes backend ErrorResponse from AxiosError', () => {
    const headers = new AxiosHeaders();
    const axiosError = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers,
        config: { headers },
        data: {
          timestamp: '2026-10-22T07:15:00Z',
          status: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          path: '/api/v1/auth/register',
          errors: {
            email: 'Email must be a valid email address',
            password: 'Password must be at least 8 characters',
          },
        },
      }
    );

    const normalized = normalizeApiError(axiosError);

    expect(normalized).toBeInstanceOf(ApiError);
    expect(normalized.status).toBe(400);
    expect(normalized.message).toBe('Validation failed');
    expect(normalized.error).toBe('Bad Request');
    expect(normalized.path).toBe('/api/v1/auth/register');
    expect(normalized.fieldErrors).toEqual({
      email: 'Email must be a valid email address',
      password: 'Password must be at least 8 characters',
    });
    expect(normalized.isValidationError).toBe(true);
  });

  it('normalizes network connection failure (ERR_NETWORK)', () => {
    const axiosError = new AxiosError('Network Error', 'ERR_NETWORK');
    const normalized = normalizeApiError(axiosError);

    expect(normalized.isNetworkError).toBe(true);
    expect(normalized.status).toBe(0);
    expect(normalized.error).toBe('Network Error');
    expect(normalized.message).toContain('Unable to connect');
  });

  it('normalizes request timeout (ECONNABORTED)', () => {
    const axiosError = new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED');
    const normalized = normalizeApiError(axiosError);

    expect(normalized.isTimeout).toBe(true);
    expect(normalized.status).toBe(408);
    expect(normalized.error).toBe('Request Timeout');
  });

  it('normalizes request cancellation without reporting a network failure', () => {
    const axiosError = new AxiosError('canceled', 'ERR_CANCELED');
    const normalized = normalizeApiError(axiosError);

    expect(normalized.isCanceled).toBe(true);
    expect(normalized.isNetworkError).toBe(false);
    expect(normalized.isTimeout).toBe(false);
    expect(normalized.status).toBe(0);
  });

  it('returns existing ApiError instance directly', () => {
    const original = new ApiError({ message: 'Original', status: 400, error: 'Bad Request' });
    expect(normalizeApiError(original)).toBe(original);
  });

  it('normalizes generic Error', () => {
    const generic = new Error('Random failure');
    const normalized = normalizeApiError(generic);

    expect(normalized.status).toBe(500);
    expect(normalized.message).toBe('Random failure');
    expect(normalized.error).toBe('Client Error');
  });
});
