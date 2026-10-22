import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/auth-context';
import { useAuth } from '../context';
import { authApi } from '../api/auth-api';
import { tokenStorage } from '@/lib/token-storage';
import { rawAxiosClient } from '@/lib/api-client';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@/lib/api-error';
import type { AuthResponse, UserProfile } from '@/types/auth';

vi.mock('../api/auth-api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

describe('AuthContext and Token Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.clearAccessToken();
  });

  it('initializes as unauthenticated when no token is in storage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      // Allow mount effect to finish
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(authApi.getCurrentUser).not.toHaveBeenCalled();
  });

  it('initializes and loads user profile when token exists in storage', async () => {
    tokenStorage.setAccessToken('existing-valid-jwt');

    const mockProfile: UserProfile = {
      id: 'user-123',
      displayName: 'Alice Resident',
      email: 'alice@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      // Wait for initializeAuth
    });

    expect(authApi.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.displayName).toBe('Alice Resident');
    expect(result.current.user?.email).toBe('alice@shareloop.org');
  });

  it('clears token and marks unauthenticated if stored token is rejected with 401', async () => {
    tokenStorage.setAccessToken('expired-token');

    const unauthorizedError = new ApiError({
      message: 'Token expired',
      status: 401,
      error: 'Unauthorized',
    });

    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(unauthorizedError);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      // Wait for initializeAuth
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('retains token on transient network error during initialization without infinite loop', async () => {
    tokenStorage.setAccessToken('existing-token');

    const networkError = new ApiError({
      message: 'Server unreachable',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });

    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {
      // Wait for initializeAuth
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error?.isNetworkError).toBe(true);
    // Retains token in storage so user can retry without having to re-login when network recovers
    expect(tokenStorage.getAccessToken()).toBe('existing-token');
  });

  it('handles login, saves token, loads profile, and updates auth state', async () => {
    const mockAuthResponse: AuthResponse = {
      id: 'user-789',
      displayName: 'Charlie User',
      email: 'charlie@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      accessToken: 'new-login-token-789',
      tokenType: 'Bearer',
    };

    const mockProfile: UserProfile = {
      id: 'user-789',
      displayName: 'Charlie User',
      email: 'charlie@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse);
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {});

    await act(async () => {
      await result.current.login({
        email: 'charlie@shareloop.org',
        password: 'password123',
      });
    });

    expect(tokenStorage.getAccessToken()).toBe('new-login-token-789');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.email).toBe('charlie@shareloop.org');
  });

  it('logout clears token and resets user authentication state', async () => {
    tokenStorage.setAccessToken('active-token');

    const mockProfile: UserProfile = {
      id: 'user-456',
      displayName: 'David User',
      email: 'david@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(tokenStorage.hasToken()).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('triggers logout when 401 unauthorized occurs on a protected endpoint', async () => {
    tokenStorage.setAccessToken('token-about-to-expire');

    const mockProfile: UserProfile = {
      id: 'user-999',
      displayName: 'Eva Admin',
      email: 'eva@shareloop.org',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await act(async () => {});

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate an unauthorized 401 response from a protected API call via axios interceptor
    await act(async () => {
      try {
        const error = new AxiosError('Unauthorized');
        const mockConfig = { url: '/api/v1/listings/mine', headers: {} } as unknown as InternalAxiosRequestConfig;
        error.config = mockConfig;
        error.response = {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: mockConfig,
          data: { status: 401, error: 'Unauthorized', message: 'Token expired' },
        } as AxiosResponse;

        // Run through rawAxiosClient response interceptor
        const handlers = (rawAxiosClient.interceptors.response as unknown as {
          handlers: Array<{ rejected?: (err: unknown) => Promise<unknown> }>;
        }).handlers;

        for (const handler of handlers) {
          if (handler && handler.rejected) {
            await handler.rejected(error).catch(() => undefined);
          }
        }
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    expect(tokenStorage.hasToken()).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
