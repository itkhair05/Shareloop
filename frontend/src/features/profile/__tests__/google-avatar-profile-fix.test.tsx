import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { ProfileHeader } from '../components/ProfileHeader';
import { AvatarManagementCard } from '../components/AvatarManagementCard';
import { resolveImageUrl } from '@/lib/utils';
import { authApi } from '@/features/auth/api/auth-api';
import { useAuth, AuthProvider } from '@/features/auth';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/auth/api/auth-api', () => ({
  authApi: {
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    getCurrentUser: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock('../api/profile-api', () => ({
  profileApi: {
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
}));

vi.mock('@/lib/token-storage', () => ({
  tokenStorage: {
    getAccessToken: vi.fn().mockReturnValue('mock-token-xyz'),
    setAccessToken: vi.fn(),
    clearAccessToken: vi.fn(),
    hasToken: vi.fn().mockReturnValue(true),
  },
}));

const mockGoogleAvatarUrl = 'https://lh3.googleusercontent.com/a/ACg8ocIHhx1vDhjbdTVKmX5kKDMT0rvM5fvkD2aM6EuEevozp4elwjE=s96-c';
const mockCustomAvatarUrl = '/api/v1/files/custom-avatar-123.jpg';

const googleUser: UserProfile = {
  id: '29e0f3d2-d052-4dab-a8a5-d3a2c59cff92',
  displayName: 'Thế Khải',
  email: 'duongthekhai.work@gmail.com',
  phoneNumber: '0901234567',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  avatarUrl: mockGoogleAvatarUrl,
  customAvatarUrl: null,
  googleAvatarUrl: mockGoogleAvatarUrl,
};

const userWithCustomAndGoogle: UserProfile = {
  ...googleUser,
  avatarUrl: mockCustomAvatarUrl,
  customAvatarUrl: mockCustomAvatarUrl,
  googleAvatarUrl: mockGoogleAvatarUrl,
};

const userWithoutAnyAvatar: UserProfile = {
  ...googleUser,
  avatarUrl: null,
  customAvatarUrl: null,
  googleAvatarUrl: null,
};

describe('ShareLoop Phase 1C.12.7.2.1 — Google Avatar Profile Display Audit & Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('A. Image URL Resolution', () => {
    it('preserves external Google image URLs directly without prepending API base URL', () => {
      const resolved = resolveImageUrl(mockGoogleAvatarUrl);
      expect(resolved).toBe(mockGoogleAvatarUrl);
      expect(resolved).not.toContain('localhost:8080');
    });

    it('safely resolves relative custom avatar paths to API base URL', () => {
      const resolved = resolveImageUrl(mockCustomAvatarUrl);
      expect(resolved).toBe(`http://localhost:8080${mockCustomAvatarUrl}`);
    });

    it('returns null for null, empty, or whitespace-only avatar URLs', () => {
      expect(resolveImageUrl(null)).toBeNull();
      expect(resolveImageUrl(undefined)).toBeNull();
      expect(resolveImageUrl('')).toBeNull();
      expect(resolveImageUrl('   ')).toBeNull();
    });
  });

  describe('B. ProfileHeader Avatar Rendering', () => {
    it('renders the Google avatar image with referrerPolicy="no-referrer" to prevent Google CDN 429/403 blocks', () => {
      renderWithProviders(<ProfileHeader user={googleUser} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Thế Khải');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg.tagName).toBe('IMG');
      expect(avatarImg).toHaveAttribute('src', mockGoogleAvatarUrl);
      expect(avatarImg).toHaveAttribute('referrerPolicy', 'no-referrer');
    });

    it('renders custom avatar when present, taking priority over Google avatar', () => {
      renderWithProviders(<ProfileHeader user={userWithCustomAndGoogle} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Thế Khải');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute(
        'src',
        `http://localhost:8080${mockCustomAvatarUrl}`
      );
    });

    it('falls back to initials when user has no avatar', () => {
      renderWithProviders(<ProfileHeader user={userWithoutAnyAvatar} />);

      expect(screen.queryByAltText('Ảnh đại diện của Thế Khải')).toBeNull();
      const initialDiv = screen.getByRole('img', {
        name: /Ảnh đại diện chữ cái của Thế Khải/i,
      });
      expect(initialDiv).toBeInTheDocument();
      expect(initialDiv).toHaveTextContent('T');
    });
  });

  describe('C. AvatarManagementCard Avatar Rendering', () => {
    it('renders Google avatar with referrerPolicy="no-referrer" in AvatarManagementCard', () => {
      renderWithProviders(<AvatarManagementCard user={googleUser} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Thế Khải');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute('src', mockGoogleAvatarUrl);
      expect(avatarImg).toHaveAttribute('referrerPolicy', 'no-referrer');
      expect(
        screen.getByText('Đang sử dụng ảnh đại diện từ tài khoản Google')
      ).toBeInTheDocument();
    });

    it('displays custom avatar when present and indicates custom avatar active', () => {
      renderWithProviders(<AvatarManagementCard user={userWithCustomAndGoogle} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Thế Khải');
      expect(avatarImg).toHaveAttribute(
        'src',
        `http://localhost:8080${mockCustomAvatarUrl}`
      );
      expect(
        screen.getByText('Ảnh đại diện tùy chỉnh đang hoạt động')
      ).toBeInTheDocument();
    });
  });

  describe('D. AuthContext & Profile Refresh Synchronization', () => {
    it('Profile refresh retains Google avatar from /api/v1/auth/me', async () => {
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(googleUser);

      function TestConsumer() {
        const { user, refreshUser } = useAuth();
        return (
          <div>
            <span data-testid="user-avatar">{user?.avatarUrl || 'none'}</span>
            <button onClick={() => refreshUser()} data-testid="refresh-btn">
              Refresh
            </button>
          </div>
        );
      }

      renderWithProviders(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // On initial mount with token, refreshUser fetches profile
      await waitFor(() => {
        expect(screen.getByTestId('user-avatar')).toHaveTextContent(mockGoogleAvatarUrl);
      });
    });

    it('Google login populates user with effective avatarUrl from /me', async () => {
      vi.mocked(authApi.loginWithGoogle).mockResolvedValue({
        id: googleUser.id,
        displayName: googleUser.displayName,
        email: googleUser.email,
        role: googleUser.role,
        status: googleUser.status,
        createdAt: googleUser.createdAt,
        accessToken: 'mock-google-access-token',
        tokenType: 'Bearer',
        avatarUrl: mockGoogleAvatarUrl,
      });
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(googleUser);

      function TestLoginConsumer() {
        const { user, loginWithGoogle } = useAuth();
        return (
          <div>
            <span data-testid="user-avatar">{user?.avatarUrl || 'none'}</span>
            <button
              onClick={() => loginWithGoogle?.('google-mock-id-token')}
              data-testid="google-login-btn"
            >
              Google Login
            </button>
          </div>
        );
      }

      renderWithProviders(
        <AuthProvider>
          <TestLoginConsumer />
        </AuthProvider>
      );

      const loginBtn = screen.getByTestId('google-login-btn');
      await act(async () => {
        fireEvent.click(loginBtn);
      });

      await waitFor(() => {
        expect(screen.getByTestId('user-avatar')).toHaveTextContent(mockGoogleAvatarUrl);
      });
    });
  });
});
