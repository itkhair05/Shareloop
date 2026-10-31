import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { PublicProfilePage } from '../pages/PublicProfilePage';
import { PublicProfileHeader } from '../components/PublicProfileHeader';
import { MyProfilePage } from '../pages/MyProfilePage';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { profileApi } from '../api/profile-api';
import { reviewApi } from '@/features/reviews/api/review-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { PublicUserProfile } from '@/types/auth';
import type { PageResponse } from '@/types/api';
import type { ListingSummaryResponse } from '@/types/listing';
import type { ReviewResponse, UserRatingSummaryResponse } from '@/types/review';

// Mock profile and review APIs
vi.mock('../api/profile-api', () => ({
  profileApi: {
    getPublicUserProfile: vi.fn(),
    getUserActiveListings: vi.fn(),
    updateProfile: vi.fn(),
  },
  profileKeys: {
    all: ['users'] as const,
    publicProfile: (userId: string) => ['users', 'public-profile', userId] as const,
    activeListings: (userId: string, params: unknown) => ['users', 'active-listings', userId, params] as const,
  },
}));

vi.mock('@/features/reviews/api/review-api', () => ({
  reviewApi: {
    getUserRatingSummary: vi.fn(),
    getUserReviews: vi.fn(),
  },
  reviewKeys: {
    all: ['reviews'] as const,
    ratingSummary: (userId: string) => ['reviews', 'rating-summary', userId] as const,
    userReviews: (userId: string, params: unknown) => ['reviews', 'user', userId, params] as const,
  },
}));

// Mock auth hook
vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockPublicUser: PublicUserProfile = {
  id: 'b5c6d7e8-f9a0-1b2c-3d4e-5f6a7b8c9d0e',
  displayName: 'Trần Thị Thu Hà',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-02-10T14:20:00Z',
};

const mockListing: ListingSummaryResponse = {
  id: 'listing-item-1',
  owner: {
    id: mockPublicUser.id,
    displayName: mockPublicUser.displayName,
  },
  category: {
    id: 'cat-books',
    name: 'Sách & Giáo trình',
    slug: 'sach-giao-trinh',
  },
  listingType: 'GIVEAWAY',
  title: 'Giáo trình Giải tích 1 ĐHBK',
  price: 0,
  currency: 'VND',
  status: 'ACTIVE',
  city: 'Hà Nội',
  country: 'Việt Nam',
  primaryImageUrl: '/api/v1/files/calculus.jpg',
  createdAt: '2026-10-21T09:00:00Z',
};

const mockListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [mockListing],
  totalElements: 10,
  totalPages: 2,
  size: 8,
  number: 0,
  first: true,
  last: false,
  empty: false,
};

const mockEmptyListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 8,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

const mockRatingSummary: UserRatingSummaryResponse = {
  userId: mockPublicUser.id,
  averageRating: 4.9,
  totalReviews: 24,
  starBreakdown: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 22 },
};

const mockReview: ReviewResponse = {
  id: 'rev-101',
  transactionId: 'tx-202',
  reviewer: {
    id: 'reviewer-uuid',
    displayName: 'Lê Hoàng Nam',
  },
  reviewee: {
    id: mockPublicUser.id,
    displayName: mockPublicUser.displayName,
  },
  listing: {
    id: 'listing-item-1',
    title: 'Giáo trình Giải tích 1 ĐHBK',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: 0,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: mockPublicUser.id,
      displayName: mockPublicUser.displayName,
    },
  },
  rating: 5,
  comment: 'Bạn Hà tặng sách rất nhanh và sách còn rất mới!',
  createdAt: '2026-10-23T11:00:00Z',
};

const mockReviewsPage: PageResponse<ReviewResponse> = {
  content: [mockReview],
  totalElements: 1,
  totalPages: 1,
  size: 5,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

describe('User Profile Phase 4B: Public User Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Unauthenticated visitor
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(profileApi.getPublicUserProfile).mockResolvedValue(mockPublicUser);
    vi.mocked(profileApi.getUserActiveListings).mockResolvedValue(mockListingsPage);
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockRatingSummary);
    vi.mocked(reviewApi.getUserReviews).mockResolvedValue(mockReviewsPage);
  });

  describe('PublicProfileHeader Component', () => {
    it('renders public information correctly without sensitive PII or edit button', () => {
      renderWithProviders(
        <PublicProfileHeader
          user={mockPublicUser}
          ratingSummary={mockRatingSummary}
        />
      );

      // Name & Avatar
      expect(screen.getByRole('heading', { level: 1, name: 'Trần Thị Thu Hà' })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /Ảnh đại diện chữ cái của Trần Thị Thu Hà/i })).toHaveTextContent('T');

      // Join date
      expect(screen.getByText(/Tham gia ShareLoop:/i)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();

      // Badges
      expect(screen.getByText('Thành viên')).toBeInTheDocument();
      expect(screen.getByText('Đang hoạt động')).toBeInTheDocument();

      // Ratings
      expect(screen.getByText('4.9')).toBeInTheDocument();
      expect(screen.getByText('(24 đánh giá)')).toBeInTheDocument();

      // SECURITY / PRIVACY ASSERTIONS:
      // Must not expose email, phone number, or edit action
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
      expect(screen.queryByText(/09\d+/)).not.toBeInTheDocument();
      expect(screen.queryByText(/\+84/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Chỉnh sửa hồ sơ/i })).not.toBeInTheDocument();
    });
  });

  describe('PublicProfilePage Integration', () => {
    it('allows unauthenticated visitors to view the public profile and listings', async () => {
      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: [`/users/${mockPublicUser.id}`] }
      );

      // Profile header rendered
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Trần Thị Thu Hà' })).toBeInTheDocument();
      });

      // Active listings rendered
      expect(screen.getByRole('heading', { level: 2, name: 'Tin đăng đang chia sẻ' })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 3, name: 'Giáo trình Giải tích 1 ĐHBK' })).toBeInTheDocument();
      });
      expect(screen.getByText('10 món đồ')).toBeInTheDocument();

      // Reviews rendered
      expect(screen.getByRole('heading', { level: 2, name: 'Đánh giá & Uy tín cộng đồng' })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Bạn Hà tặng sách rất nhanh và sách còn rất mới!')).toBeInTheDocument();
      });

      // Security check on whole page: No email or phone anywhere
      expect(screen.queryByText(/@/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Chỉnh sửa hồ sơ/i)).not.toBeInTheDocument();
    });

    it('supports pagination for active listings', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: [`/users/${mockPublicUser.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText(/Trang 1 trên 2/i)).toBeInTheDocument();
      });

      const nextBtn = screen.getByRole('button', { name: /Trang sau/i });
      expect(nextBtn).toBeEnabled();

      await user.click(nextBtn);

      await waitFor(() => {
        expect(profileApi.getUserActiveListings).toHaveBeenCalledWith(
          mockPublicUser.id,
          { page: 1, size: 8 }
        );
      });
    });

    it('renders Vietnamese empty state when user has no active listings', async () => {
      vi.mocked(profileApi.getUserActiveListings).mockResolvedValueOnce(mockEmptyListingsPage);

      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: [`/users/${mockPublicUser.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText('Chưa có tin đăng nào đang hoạt động')).toBeInTheDocument();
        expect(
          screen.getByText(/Trần Thị Thu Hà hiện chưa có tin đăng chia sẻ nào đang khả dụng/i)
        ).toBeInTheDocument();
      });
    });

    it('renders invalid ID empty state when route parameter is not a UUID without calling APIs', () => {
      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: ['/users/invalid-non-uuid-123'] }
      );

      expect(screen.getByText('Mã người dùng không hợp lệ')).toBeInTheDocument();
      expect(profileApi.getPublicUserProfile).not.toHaveBeenCalled();
      expect(profileApi.getUserActiveListings).not.toHaveBeenCalled();
    });

    it('handles 404 Not Found error gracefully', async () => {
      const notFoundError = new ApiError({
        message: 'User not found with id: ' + mockPublicUser.id,
        status: 404,
        error: 'Not Found',
      });
      vi.mocked(profileApi.getPublicUserProfile).mockRejectedValueOnce(notFoundError);

      const queryClient = createTestQueryClient();
      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: [`/users/${mockPublicUser.id}`], queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('Không tìm thấy người dùng')).toBeInTheDocument();
      });
    });

    it('handles server error and allows retrying', async () => {
      const serverError = new ApiError({
        message: 'Database connection failed',
        status: 500,
        error: 'Internal Server Error',
      });
      vi.mocked(profileApi.getPublicUserProfile).mockRejectedValueOnce(serverError);

      const queryClient = createTestQueryClient();
      renderWithProviders(
        <Routes>
          <Route path="/users/:userId" element={<PublicProfilePage />} />
        </Routes>,
        { initialEntries: [`/users/${mockPublicUser.id}`], queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('Không thể tải hồ sơ người dùng')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });
  });

  describe('Route Protection Contrast', () => {
    it('confirms that /profile still redirects unauthenticated visitors to /login', () => {
      renderWithProviders(
        <Routes>
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <MyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Trang đăng nhập</div>} />
        </Routes>,
        { initialEntries: ['/profile'] }
      );

      expect(screen.getByText('Trang đăng nhập')).toBeInTheDocument();
    });
  });

  describe('Public Profile Avatar Integration', () => {
    it('renders effective avatar image when public user has avatarUrl', () => {
      const userWithAvatar: PublicUserProfile = {
        ...mockPublicUser,
        avatarUrl: '/api/v1/files/avatars/public-ha.jpg',
      };

      renderWithProviders(
        <PublicProfileHeader
          user={userWithAvatar}
          ratingSummary={mockRatingSummary}
        />
      );

      const avatarImg = screen.getByRole('img', { name: /Ảnh đại diện của Trần Thị Thu Hà/i });
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute('src', 'http://localhost:8080/api/v1/files/avatars/public-ha.jpg');
    });

    it('falls back to initials when avatarUrl is null', () => {
      const userWithoutAvatar: PublicUserProfile = {
        ...mockPublicUser,
        avatarUrl: null,
      };

      renderWithProviders(
        <PublicProfileHeader
          user={userWithoutAvatar}
          ratingSummary={mockRatingSummary}
        />
      );

      expect(screen.getByText('TH')).toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();
    });

    it('does not break when avatarUrl is undefined', () => {
      const userWithUndefinedAvatar: PublicUserProfile = {
        ...mockPublicUser,
        avatarUrl: undefined,
      };

      renderWithProviders(
        <PublicProfileHeader
          user={userWithUndefinedAvatar}
          ratingSummary={mockRatingSummary}
        />
      );

      expect(screen.getByText('TH')).toBeInTheDocument();
    });

    it('updates displayed avatar when navigating between different public profiles', () => {
      const secondUser: PublicUserProfile = {
        id: 'user-2-uuid',
        displayName: 'Nguyễn Văn Nam',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-03-01T10:00:00Z',
        avatarUrl: '/api/v1/files/avatars/nam.jpg',
      };

      const { rerender } = renderWithProviders(
        <PublicProfileHeader
          user={mockPublicUser}
          ratingSummary={mockRatingSummary}
        />
      );

      expect(screen.getByText('TH')).toBeInTheDocument();
      expect(document.querySelector('img')).toBeNull();

      rerender(
        <PublicProfileHeader
          user={secondUser}
          ratingSummary={mockRatingSummary}
        />
      );

      expect(screen.getByRole('heading', { level: 1, name: 'Nguyễn Văn Nam' })).toBeInTheDocument();
      const namImg = screen.getByRole('img', { name: /Ảnh đại diện của Nguyễn Văn Nam/i });
      expect(namImg).toHaveAttribute('src', 'http://localhost:8080/api/v1/files/avatars/nam.jpg');
    });

    it('confirms the public profile UI does not require private avatar fields', () => {
      const minimalPublicUser: PublicUserProfile = {
        id: 'user-min',
        displayName: 'Lê Thảo',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
      };

      renderWithProviders(
        <PublicProfileHeader
          user={minimalPublicUser}
          ratingSummary={mockRatingSummary}
        />
      );

      const img = screen.getByRole('img', { name: /Ảnh đại diện của Lê Thảo/i });
      expect(img).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/google-avatar');
    });
  });
});
