import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { MyProfilePage } from '../pages/MyProfilePage';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileStatsCards } from '../components/ProfileStatsCards';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { useAuth } from '@/features/auth';
import { listingApi } from '@/features/listings/api/listing-api';
import { reviewApi } from '@/features/reviews/api/review-api';
import { profileApi } from '../api/profile-api';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import type { UserProfile } from '@/types/auth';
import type { PageResponse } from '@/types/api';
import type { ListingSummaryResponse } from '@/types/listing';
import type { ReviewResponse, UserRatingSummaryResponse } from '@/types/review';

// Mock profile API
vi.mock('../api/profile-api', () => ({
  profileApi: {
    updateProfile: vi.fn(),
  },
}));

// Mock auth API for Google linking and password management cards
vi.mock('@/features/auth/api/auth-api', () => ({
  authApi: {
    getGoogleAccountStatus: vi.fn().mockResolvedValue({
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    }),
    linkGoogleAccount: vi.fn(),
    changePassword: vi.fn(),
    setPassword: vi.fn(),
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

// Mock listing and review APIs
vi.mock('@/features/listings/api/listing-api', () => ({
  listingApi: {
    getMyListings: vi.fn(),
    getListings: vi.fn(),
    getListingById: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    mine: (params: unknown) => ['listings', 'mine', params] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
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

const mockUser: UserProfile = {
  id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  displayName: 'Nguyễn Văn Minh',
  email: 'minh.nguyen@shareloop.org',
  phoneNumber: '0912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
};

const mockListing: ListingSummaryResponse = {
  id: 'listing-uuid-1',
  owner: {
    id: mockUser.id,
    displayName: mockUser.displayName,
  },
  category: {
    id: 'cat-furniture',
    name: 'Đồ nội thất',
    slug: 'do-noi-that',
  },
  listingType: 'GIVEAWAY',
  title: 'Bàn gỗ học sinh',
  price: 0,
  currency: 'VND',
  status: 'ACTIVE',
  city: 'Hồ Chí Minh',
  country: 'Việt Nam',
  primaryImageUrl: '/api/v1/files/table.jpg',
  createdAt: '2026-10-20T10:00:00Z',
};

const mockListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [mockListing],
  totalElements: 12, // Specifically testing metadata count vs content array length
  totalPages: 3,
  size: 4,
  number: 0,
  first: true,
  last: false,
  empty: false,
};

const mockEmptyListingsPage: PageResponse<ListingSummaryResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 4,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

const mockRatingSummary: UserRatingSummaryResponse = {
  userId: mockUser.id,
  averageRating: 4.8,
  totalReviews: 15,
  starBreakdown: {
    1: 0,
    2: 0,
    3: 1,
    4: 1,
    5: 13,
  },
};

const mockReview: ReviewResponse = {
  id: 'review-1',
  transactionId: 'tx-1',
  reviewer: {
    id: 'reviewer-user-id',
    displayName: 'Trần Thị Bích',
  },
  reviewee: {
    id: mockUser.id,
    displayName: mockUser.displayName,
  },
  listing: {
    id: 'listing-uuid-1',
    title: 'Bàn gỗ học sinh',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: 0,
    currency: 'VND',
    city: 'Hồ Chí Minh',
    owner: {
      id: mockUser.id,
      displayName: mockUser.displayName,
    },
  },
  rating: 5,
  comment: 'Người tặng rất nhiệt tình và chu đáo!',
  createdAt: '2026-10-22T14:00:00Z',
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

const mockEmptyReviewsPage: PageResponse<ReviewResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 5,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('User Profile Phase 1: My Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });

    vi.mocked(listingApi.getMyListings).mockResolvedValue(mockListingsPage);
    vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValue(mockRatingSummary);
    vi.mocked(reviewApi.getUserReviews).mockResolvedValue(mockReviewsPage);
  });

  describe('ProfileHeader Component', () => {
    it('renders initials-based avatar using displayName', () => {
      renderWithProviders(<ProfileHeader user={mockUser} ratingSummary={mockRatingSummary} />);

      const avatar = screen.getByRole('img', { name: /Ảnh đại diện chữ cái của Nguyễn Văn Minh/i });
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent('N');
    });

    it('renders display name, email, and formatted join date in Vietnamese', () => {
      renderWithProviders(<ProfileHeader user={mockUser} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('Nguyễn Văn Minh')).toBeInTheDocument();
      expect(screen.getByText('minh.nguyen@shareloop.org')).toBeInTheDocument();
      expect(screen.getByText(/Tham gia:/i)).toBeInTheDocument();
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });

    it('renders phone number when present', () => {
      renderWithProviders(<ProfileHeader user={mockUser} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('0912345678')).toBeInTheDocument();
    });

    it('displays fallback "Chưa cập nhật" when phone number is absent or null', () => {
      const userWithoutPhone: UserProfile = {
        ...mockUser,
        phoneNumber: null,
      };

      renderWithProviders(<ProfileHeader user={userWithoutPhone} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();
    });

    it('displays fallback "Chưa cập nhật" when phone number is blank string', () => {
      const userWithBlankPhone: UserProfile = {
        ...mockUser,
        phoneNumber: '   ',
      };

      renderWithProviders(<ProfileHeader user={userWithBlankPhone} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();
    });

    it('renders role and account status badges correctly', () => {
      renderWithProviders(<ProfileHeader user={mockUser} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('Thành viên')).toBeInTheDocument();
      expect(screen.getByText('Đang hoạt động')).toBeInTheDocument();
    });

    it('renders admin badge and suspended status badge for admin user', () => {
      const adminUser: UserProfile = {
        ...mockUser,
        role: 'ADMIN',
        status: 'SUSPENDED',
      };

      renderWithProviders(<ProfileHeader user={adminUser} ratingSummary={mockRatingSummary} />);

      expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
      expect(screen.getByText('Bị tạm khóa')).toBeInTheDocument();
    });
  });

  describe('ProfileStatsCards Component', () => {
    it('renders total listings count using totalElements metadata', () => {
      renderWithProviders(
        <ProfileStatsCards
          totalListings={12}
          isLoadingListings={false}
          averageRating={4.8}
          totalReviews={15}
          isLoadingRating={false}
        />
      );

      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Tin đăng của tôi')).toBeInTheDocument();
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText(/15 lượt đánh giá/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Quản lý/i })).toHaveAttribute('href', '/my-listings');
    });

    it('displays fallback when no reviews are present', () => {
      renderWithProviders(
        <ProfileStatsCards
          totalListings={0}
          isLoadingListings={false}
          averageRating={0}
          totalReviews={0}
          isLoadingRating={false}
        />
      );

      expect(screen.getByText('Chưa có')).toBeInTheDocument();
      expect(screen.getByText('Chưa có lượt đánh giá')).toBeInTheDocument();
    });
  });

  describe('MyProfilePage Full Page Integration', () => {
    it('renders complete profile page with listings and reviews', async () => {
      renderWithProviders(<MyProfilePage />);

      // Heading and Header
      expect(screen.getByRole('heading', { level: 1, name: 'Hồ sơ của tôi' })).toBeInTheDocument();
      expect(screen.getByText('Nguyễn Văn Minh')).toBeInTheDocument();

      // Recent Listings Section
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: 'Tin đăng gần đây' })).toBeInTheDocument();
      });

      // Total count reflects metadata (12 món đồ)
      await waitFor(() => {
        expect(screen.getByText('12 món đồ')).toBeInTheDocument();
      });
      expect(screen.getByText('Xem tất cả (12)')).toBeInTheDocument();

      // Listing Card rendered
      expect(screen.getByRole('heading', { level: 3, name: 'Bàn gỗ học sinh' })).toBeInTheDocument();

      // Reviews Section
      expect(screen.getByRole('heading', { level: 2, name: 'Đánh giá & Uy tín cộng đồng' })).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByText('Người tặng rất nhiệt tình và chu đáo!')).toBeInTheDocument();
      });
    });

    it('renders EmptyState when user has no listings', async () => {
      vi.mocked(listingApi.getMyListings).mockResolvedValueOnce(mockEmptyListingsPage);

      renderWithProviders(<MyProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Bạn chưa có tin đăng nào')).toBeInTheDocument();
      });
      expect(screen.getByText('Đăng tin ngay')).toBeInTheDocument();
    });

    it('renders ErrorAlert with retry button when listings API fails', async () => {
      vi.mocked(listingApi.getMyListings).mockRejectedValueOnce(new Error('Network error'));

      const queryClient = createTestQueryClient();
      renderWithProviders(<MyProfilePage />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText('Không thể tải tin đăng')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });

    it('renders EmptyState for reviews when user has 0 reviews', async () => {
      vi.mocked(reviewApi.getUserRatingSummary).mockResolvedValueOnce({
        userId: mockUser.id,
        averageRating: 0,
        totalReviews: 0,
        starBreakdown: {},
      });
      vi.mocked(reviewApi.getUserReviews).mockResolvedValueOnce(mockEmptyReviewsPage);

      renderWithProviders(<MyProfilePage />);

      await waitFor(() => {
        expect(screen.getByText('Chưa có nhận xét nào')).toBeInTheDocument();
      });
    });

    it('renders loading spinner when auth state is loading', () => {
      vi.mocked(useAuth).mockReturnValueOnce({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        clearError: vi.fn(),
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      renderWithProviders(<MyProfilePage />);

      expect(screen.getByRole('status')).toHaveTextContent('Đang tải thông tin hồ sơ cá nhân...');
    });

    it('renders "Chỉnh sửa hồ sơ" action buttons on the page', () => {
      renderWithProviders(<MyProfilePage />);

      const editButtons = screen.getAllByRole('button', { name: /Chỉnh sửa hồ sơ/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('opens EditProfileModal when clicking "Chỉnh sửa hồ sơ" button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MyProfilePage />);

      const editBtn = screen.getAllByRole('button', { name: /Chỉnh sửa hồ sơ/i })[0];
      await user.click(editBtn);

      expect(screen.getByRole('dialog', { name: /Chỉnh sửa hồ sơ/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Tên hiển thị/i)).toHaveValue(mockUser.displayName);
    });

    it('displays success notification upon successful profile update', async () => {
      const user = userEvent.setup();
      const updatedUser: UserProfile = {
        ...mockUser,
        displayName: 'Nguyễn Minh Mới',
      };
      vi.mocked(profileApi.updateProfile).mockResolvedValueOnce(updatedUser);

      renderWithProviders(<MyProfilePage />);

      // Open modal
      const editBtn = screen.getAllByRole('button', { name: /Chỉnh sửa hồ sơ/i })[0];
      await user.click(editBtn);

      const nameInput = screen.getByLabelText(/Tên hiển thị/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Nguyễn Minh Mới');

      const phoneInput = screen.getByLabelText(/Số điện thoại/i);
      await user.clear(phoneInput);
      await user.type(phoneInput, '0912345678');

      const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Cập nhật thông tin hồ sơ thành công!')).toBeInTheDocument();
      });
    });
  });

  describe('ProtectedRoute Behavior for /profile', () => {
    it('redirects unauthenticated users to /login preserving state', () => {
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
});
