import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { authApi } from '../api/auth-api';
import { tokenStorage } from '@/lib/token-storage';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import * as googleIdentity from '../utils/google-identity';
import type { AuthResponse, UserProfile } from '@/types/auth';

vi.mock('../api/auth-api', () => ({
  authApi: {
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('Google Authentication Flows', () => {
  let capturedCallback: ((idToken: string) => void) | undefined;

  const mockGoogleAuthResponse: AuthResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    displayName: 'Google User',
    email: 'googleuser@gmail.com',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-10-30T10:00:00Z',
    accessToken: 'mock-google-jwt-token-123',
    tokenType: 'Bearer',
  };

  const mockProfile: UserProfile = {
    id: '11111111-1111-1111-1111-111111111111',
    displayName: 'Google User',
    email: 'googleuser@gmail.com',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-10-30T10:00:00Z',
    updatedAt: '2026-10-30T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.clearAccessToken();
    capturedCallback = undefined;

    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'getGoogleClientId').mockReturnValue('mock-client-id');
    vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation((options) => {
      capturedCallback = options.onCredentialReceived;
    });
    vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());
  });

  describe('LoginPage Google Flow', () => {
    it('successfully logs in with Google ID token, saves token, and redirects', async () => {
      vi.mocked(authApi.loginWithGoogle).mockResolvedValueOnce(mockGoogleAuthResponse);
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('valid-google-id-token');
      });

      await waitFor(() => {
        expect(authApi.loginWithGoogle).toHaveBeenCalledWith({ idToken: 'valid-google-id-token' });
        expect(tokenStorage.getAccessToken()).toBe('mock-google-jwt-token-123');
      });
    });

    it('displays Vietnamese explanation for AccountLinkingRequiredException (HTTP 409)', async () => {
      vi.mocked(authApi.loginWithGoogle).mockRejectedValueOnce(
        new ApiError({
          status: 409,
          error: 'Conflict',
          message:
            'An account with this email already exists. Please log in with your email and password first, then link your Google account in settings.',
        })
      );

      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('google-token-existing-email');
      });

      await waitFor(() => {
        expect(
          screen.getByText(/yêu cầu đăng nhập bằng mật khẩu/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/tài khoản với email này đã được đăng ký bằng mật khẩu/i)
        ).toBeInTheDocument();
      });
    });

    it('displays error message when Google login receives 403 Forbidden', async () => {
      vi.mocked(authApi.loginWithGoogle).mockRejectedValueOnce(
        new ApiError({
          status: 403,
          error: 'Forbidden',
          message: 'Tài khoản của bạn đã bị tạm khóa do vi phạm tiêu chuẩn cộng đồng.',
        })
      );

      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('token-suspended-user');
      });

      await waitFor(() => {
        expect(
          screen.getByText(/tài khoản của bạn đã bị tạm khóa do vi phạm tiêu chuẩn cộng đồng/i)
        ).toBeInTheDocument();
      });
    });

    it('displays network error message when server is unreachable', async () => {
      vi.mocked(authApi.loginWithGoogle).mockRejectedValueOnce(
        new ApiError({
          status: 0,
          error: 'Network Error',
          message: 'Network Error',
          isNetworkError: true,
        })
      );

      renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('token-network-fail');
      });

      await waitFor(() => {
        expect(
          screen.getByText(/không thể kết nối đến máy chủ/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('RegisterPage Google Flow', () => {
    it('successfully registers with Google ID token, saves token, and redirects', async () => {
      vi.mocked(authApi.loginWithGoogle).mockResolvedValueOnce(mockGoogleAuthResponse);
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

      renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('new-user-google-token');
      });

      await waitFor(() => {
        expect(authApi.loginWithGoogle).toHaveBeenCalledWith({ idToken: 'new-user-google-token' });
        expect(tokenStorage.getAccessToken()).toBe('mock-google-jwt-token-123');
      });
    });

    it('displays linking instruction and login link on RegisterPage when receiving HTTP 409', async () => {
      vi.mocked(authApi.loginWithGoogle).mockRejectedValueOnce(
        new ApiError({
          status: 409,
          error: 'Conflict',
          message: 'Account linking required',
        })
      );

      renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

      await waitFor(() => {
        expect(capturedCallback).toBeDefined();
      });

      await act(async () => {
        capturedCallback!('existing-account-token');
      });

      await waitFor(() => {
        expect(screen.getByText(/email đã tồn tại/i)).toBeInTheDocument();
        expect(
          screen.getByText(/chuyển đến trang đăng nhập/i)
        ).toHaveAttribute('href', '/login');
      });
    });
  });
});
