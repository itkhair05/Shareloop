import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/auth-context';
import { useAuth } from '../context';
import { authApi } from '../api/auth-api';
import { tokenStorage } from '@/lib/token-storage';
import type { UserProfile } from '@/types/auth';

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

describe('AuthContext Avatar State Synchronization', () => {
  const initialUser: UserProfile = {
    id: 'user-uuid-1',
    displayName: 'Nguyễn Văn Minh',
    email: 'minh.nguyen@shareloop.org',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-03-15T08:30:00Z',
    updatedAt: '2026-03-15T08:30:00Z',
    avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
    customAvatarUrl: null,
    googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.setAccessToken('valid-jwt-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(initialUser);
  });

  it('updates authenticated user state when updateUser is invoked with custom avatar', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      // Wait for initial load
    });

    expect(result.current.user?.avatarUrl).toBe('https://lh3.googleusercontent.com/a/google-avatar');
    expect(result.current.user?.customAvatarUrl).toBeNull();

    // Simulate custom avatar upload completion
    const uploadedProfile: UserProfile = {
      ...initialUser,
      avatarUrl: '/api/v1/files/avatars/new-custom.jpg',
      customAvatarUrl: '/api/v1/files/avatars/new-custom.jpg',
    };

    act(() => {
      result.current.updateUser?.(uploadedProfile);
    });

    expect(result.current.user?.avatarUrl).toBe('/api/v1/files/avatars/new-custom.jpg');
    expect(result.current.user?.customAvatarUrl).toBe('/api/v1/files/avatars/new-custom.jpg');
  });

  it('restores Google avatar in authenticated user state when custom avatar is deleted', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      // Wait for initial load
    });

    // Start with custom avatar active
    const userWithCustom: UserProfile = {
      ...initialUser,
      avatarUrl: '/api/v1/files/avatars/custom.jpg',
      customAvatarUrl: '/api/v1/files/avatars/custom.jpg',
    };

    act(() => {
      result.current.updateUser?.(userWithCustom);
    });
    expect(result.current.user?.customAvatarUrl).toBe('/api/v1/files/avatars/custom.jpg');

    // Simulate avatar deletion
    const profileAfterDelete: UserProfile = {
      ...initialUser,
      avatarUrl: initialUser.googleAvatarUrl,
      customAvatarUrl: null,
    };

    act(() => {
      result.current.updateUser?.(profileAfterDelete);
    });

    expect(result.current.user?.customAvatarUrl).toBeNull();
    expect(result.current.user?.avatarUrl).toBe('https://lh3.googleusercontent.com/a/google-avatar');
  });

  it('synchronizes avatar updates across multiple mounted useAuth consumers', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({
        consumerA: useAuth(),
        consumerB: useAuth(),
      }),
      { wrapper }
    );

    await act(async () => {
      // Wait for initial load
    });

    const updatedProfile: UserProfile = {
      ...initialUser,
      avatarUrl: '/api/v1/files/avatars/synced.png',
      customAvatarUrl: '/api/v1/files/avatars/synced.png',
    };

    act(() => {
      result.current.consumerA.updateUser?.(updatedProfile);
    });

    expect(result.current.consumerA.user?.avatarUrl).toBe('/api/v1/files/avatars/synced.png');
    expect(result.current.consumerB.user?.avatarUrl).toBe('/api/v1/files/avatars/synced.png');
  });

  it('refreshUser fetches and synchronizes new avatar fields from GET /api/v1/auth/me', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      // Initial load
    });

    const refreshedProfile: UserProfile = {
      ...initialUser,
      avatarUrl: '/api/v1/files/avatars/refreshed.jpg',
      customAvatarUrl: '/api/v1/files/avatars/refreshed.jpg',
    };
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(refreshedProfile);

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.avatarUrl).toBe('/api/v1/files/avatars/refreshed.jpg');
    expect(result.current.user?.customAvatarUrl).toBe('/api/v1/files/avatars/refreshed.jpg');
  });
});
