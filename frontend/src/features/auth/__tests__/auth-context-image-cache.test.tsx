import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/auth-context';
import { useAuth } from '../context';
import { authApi } from '../api/auth-api';
import { tokenStorage } from '@/lib/token-storage';
import { clearChatImageCache } from '@/lib/chat-image-cache';
import { ApiError } from '@/lib/api-error';
import type { AuthResponse, UserProfile } from '@/types/auth';

vi.mock('../api/auth-api', () => ({
  authApi: {
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock('@/lib/chat-image-cache', () => ({
  clearChatImageCache: vi.fn(),
}));

const mockProfile: UserProfile = {
  id: 'user-123',
  displayName: 'Alice Resident',
  email: 'alice@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
};

const mockAuthResponse: AuthResponse = {
  id: mockProfile.id,
  displayName: mockProfile.displayName,
  email: mockProfile.email,
  role: mockProfile.role,
  status: mockProfile.status,
  createdAt: mockProfile.createdAt,
  accessToken: 'new-token',
  tokenType: 'Bearer',
};

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

beforeEach(() => {
  vi.clearAllMocks();
  tokenStorage.clearAccessToken();
});

describe('AuthProvider — vòng đời bộ nhớ đệm ảnh trò chuyện', () => {
  it('xóa bộ nhớ đệm ảnh riêng tư khi đăng xuất', async () => {
    tokenStorage.setAccessToken('active-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {});

    act(() => {
      result.current.logout();
    });

    expect(clearChatImageCache).toHaveBeenCalledTimes(1);
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('xóa bộ nhớ đệm ảnh của phiên trước khi đăng nhập phiên mới', async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse);
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {});

    await act(async () => {
      await result.current.login({
        email: 'alice@shareloop.org',
        password: 'password123',
      });
    });

    expect(clearChatImageCache).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('xóa bộ nhớ đệm ảnh khi token lưu sẵn bị từ chối 401 lúc khởi tạo', async () => {
    tokenStorage.setAccessToken('expired-token');
    vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(
      new ApiError({
        message: 'Unauthorized',
        status: 401,
        error: 'Unauthorized',
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    await act(async () => {});

    expect(clearChatImageCache).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(false);
    expect(tokenStorage.hasToken()).toBe(false);
  });
});
