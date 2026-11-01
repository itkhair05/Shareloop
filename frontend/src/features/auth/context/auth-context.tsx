import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '@/lib/token-storage';
import { setUnauthorizedHandler } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { clearChatImageCache } from '@/lib/chat-image-cache';
import { authApi } from '../api/auth-api';
import { AuthContext, type AuthContextValue } from './auth-context-base';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';


export interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const initializingRef = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clearAccessToken();
    setUser(null);
    setError(null);
    // Drop private chat image blobs and their Object URLs before anything else
    clearChatImageCache();
    // Clear all TanStack query caches to prevent data leakage across users
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((updatedUser: UserProfile) => {
    setUser(updatedUser);
  }, []);

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    if (!tokenStorage.hasToken()) {
      setUser(null);
      return null;
    }

    try {
      const profile = await authApi.getCurrentUser();
      setUser(profile);
      setError(null);
      return profile;
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        tokenStorage.clearAccessToken();
        clearChatImageCache();
        setUser(null);
      } else if (err instanceof ApiError) {
        setError(err);
      }
      return null;
    }
  }, []);

  const login = useCallback(
    async (credentials: LoginRequest): Promise<AuthResponse> => {
      setError(null);
      try {
        const response = await authApi.login(credentials);
        tokenStorage.setAccessToken(response.accessToken);
        clearChatImageCache();

        // Fetch complete user profile from /me
        try {
          const profile = await authApi.getCurrentUser();
          setUser(profile);
        } catch {
          // Fallback to response fields if /me temporarily fails
          setUser({
            id: response.id,
            displayName: response.displayName,
            email: response.email,
            role: response.role,
            status: response.status,
            createdAt: response.createdAt,
            updatedAt: response.createdAt,
            avatarUrl: response.avatarUrl,
          });
        }

        return response;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError({
          message: 'Login failed',
          status: 500,
          error: 'Login Error',
        });
        setError(apiError);
        throw apiError;
      }
    },
    []
  );

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<AuthResponse> => {
      setError(null);
      try {
        const response = await authApi.loginWithGoogle({ idToken });
        tokenStorage.setAccessToken(response.accessToken);
        clearChatImageCache();

        // Fetch complete user profile from /me
        try {
          const profile = await authApi.getCurrentUser();
          setUser(profile);
        } catch {
          // Fallback to response fields if /me temporarily fails
          setUser({
            id: response.id,
            displayName: response.displayName,
            email: response.email,
            role: response.role,
            status: response.status,
            createdAt: response.createdAt,
            updatedAt: response.createdAt,
            avatarUrl: response.avatarUrl,
          });
        }

        return response;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError({
          message: 'Google login failed',
          status: 500,
          error: 'Login Error',
        });
        setError(apiError);
        throw apiError;
      }
    },
    []
  );

  const register = useCallback(
    async (data: RegisterRequest): Promise<AuthResponse> => {
      setError(null);
      try {
        const response = await authApi.register(data);
        tokenStorage.setAccessToken(response.accessToken);
        clearChatImageCache();

        try {
          const profile = await authApi.getCurrentUser();
          setUser(profile);
        } catch {
          setUser({
            id: response.id,
            displayName: response.displayName,
            email: response.email,
            role: response.role,
            status: response.status,
            createdAt: response.createdAt,
            updatedAt: response.createdAt,
            avatarUrl: response.avatarUrl,
          });
        }

        return response;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError({
          message: 'Registration failed',
          status: 500,
          error: 'Registration Error',
        });
        setError(apiError);
        throw apiError;
      }
    },
    []
  );

  // Initialize authentication on mount
  useEffect(() => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    async function initializeAuth() {
      if (tokenStorage.hasToken()) {
        try {
          const profile = await authApi.getCurrentUser();
          setUser(profile);
        } catch (err) {
          if (err instanceof ApiError && err.isUnauthorized) {
            tokenStorage.clearAccessToken();
            clearChatImageCache();
            setUser(null);
          } else if (err instanceof ApiError) {
            setError(err);
          }
        }
      }
      setIsLoading(false);
    }

    initializeAuth();
  }, []);

  // Register 401 unauthorized handler to trigger automatic logout
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user && tokenStorage.hasToken()),
      isLoading,
      error,
      login,
      loginWithGoogle,
      register,
      logout,
      clearError,
      refreshUser,
      updateUser,
    }),
    [user, isLoading, error, login, loginWithGoogle, register, logout, clearError, refreshUser, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
