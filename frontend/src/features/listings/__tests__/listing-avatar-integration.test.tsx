import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { ListingCard } from '../components/ListingCard';
import { ListingDetailPage } from '../pages/ListingDetailPage';
import { ListingRequestsManager } from '@/features/requests';
import { listingApi } from '../api/listing-api';
import { requestApi } from '@/features/requests/api/request-api';
import { useAuth } from '@/features/auth';
import type { ListingResponse, ListingSummaryResponse } from '@/types/listing';
import type { ListingRequestResponse } from '@/types/request';
import type { PageResponse } from '@/types/api';

function createMockPageResponse<T>(content: T[]): PageResponse<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 5,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

vi.mock('../api/listing-api', () => ({
  listingApi: {
    getListings: vi.fn(),
    getListingById: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    lists: () => ['listings', 'list'] as const,
    list: (params: unknown) => ['listings', 'list', params] as const,
    details: () => ['listings', 'detail'] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
  },
}));

vi.mock('@/features/requests/api/request-api', () => ({
  requestApi: {
    getRequestsForListing: vi.fn(),
    getMyRequests: vi.fn(),
    createRequest: vi.fn(),
    updateRequestStatus: vi.fn(),
    withdrawRequest: vi.fn(),
  },
  requestKeys: {
    all: ['requests'] as const,
    mineLists: () => ['requests', 'mine'] as const,
    mine: (params?: unknown) => ['requests', 'mine', params] as const,
    listingLists: () => ['requests', 'listing'] as const,
    listing: (listingId: string, params?: unknown) =>
      ['requests', 'listing', listingId, params] as const,
  },
}));

vi.mock('@/features/reviews', () => ({
  OwnerRatingBadge: () => <div data-testid="owner-rating-badge">4.8 (12)</div>,
  OwnerReputationSection: () => <div data-testid="owner-reputation-section">Reputation Section</div>,
}));

vi.mock('@/features/auth', () => ({
  useAuth: vi.fn(),
}));

describe('ShareLoop Phase 1C.12.7.3.2 — Listing & Listing Requests Avatar Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Listing Feed Cards (ListingCard)', () => {
    const baseSummary: ListingSummaryResponse = {
      id: 'listing-summary-001',
      owner: {
        id: 'owner-001',
        displayName: 'Nguyễn Văn An',
        avatarUrl: '/api/v1/files/owner-custom.png',
      },
      category: { id: 'cat-1', name: 'Đồ điện tử', slug: 'electronics' },
      listingType: 'GIVEAWAY',
      title: 'Bàn phím cơ không dùng tới',
      price: null,
      currency: null,
      status: 'ACTIVE',
      city: 'TP. Hồ Chí Minh',
      country: 'Việt Nam',
      primaryImageUrl: null,
      createdAt: '2026-03-01T10:00:00Z',
    };

    it('renders custom avatar image correctly using resolved avatarUrl', () => {
      renderWithProviders(<ListingCard listing={baseSummary} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Nguyễn Văn An');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg.tagName).toBe('IMG');
      expect(avatarImg).toHaveAttribute(
        'src',
        'http://localhost:8080/api/v1/files/owner-custom.png'
      );
      expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    });

    it('renders Google avatar URL correctly', () => {
      const googleSummary: ListingSummaryResponse = {
        ...baseSummary,
        id: 'listing-summary-002',
        owner: {
          id: 'owner-002',
          displayName: 'Trần Thị Mai',
          avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar-mai',
        },
      };

      renderWithProviders(<ListingCard listing={googleSummary} />);

      const avatarImg = screen.getByAltText('Ảnh đại diện của Trần Thị Mai');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute(
        'src',
        'https://lh3.googleusercontent.com/a/google-avatar-mai'
      );
      expect(screen.getByText('Trần Thị Mai')).toBeInTheDocument();
    });

    it('falls back to initials when owner avatarUrl is null', () => {
      const nullAvatarSummary: ListingSummaryResponse = {
        ...baseSummary,
        id: 'listing-summary-003',
        owner: {
          id: 'owner-003',
          displayName: 'Lê Hoàng Cường',
          avatarUrl: null,
        },
      };

      renderWithProviders(<ListingCard listing={nullAvatarSummary} />);

      expect(screen.queryByRole('img', { name: 'Ảnh đại diện của Lê Hoàng Cường' })).toBeInTheDocument();
      expect(screen.getByText('LC')).toBeInTheDocument();
      expect(screen.getByText('Lê Hoàng Cường')).toBeInTheDocument();
    });

    it('handles missing (undefined) avatar field gracefully without crashing', () => {
      const missingAvatarSummary: ListingSummaryResponse = {
        ...baseSummary,
        id: 'listing-summary-004',
        owner: {
          id: 'owner-004',
          displayName: 'Phạm Đức Dũng',
        },
      };

      renderWithProviders(<ListingCard listing={missingAvatarSummary} />);

      expect(screen.getByText('PD')).toBeInTheDocument();
      expect(screen.getByText('Phạm Đức Dũng')).toBeInTheDocument();
    });

    it('preserves existing card navigation link and owner name', () => {
      renderWithProviders(<ListingCard listing={baseSummary} />);

      const cardLink = screen.getByRole('link', {
        name: /Xem chi tiết bài đăng: Bàn phím cơ không dùng tới/i,
      });
      expect(cardLink).toHaveAttribute('href', `/listings/${baseSummary.id}`);
      expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    });

    it('renders different avatars for different listing owners in a feed list', () => {
      const listing1: ListingSummaryResponse = {
        ...baseSummary,
        id: 'feed-1',
        title: 'Món 1',
        owner: {
          id: 'owner-1',
          displayName: 'Võ Minh Trí',
          avatarUrl: 'https://example.com/tri.jpg',
        },
      };
      const listing2: ListingSummaryResponse = {
        ...baseSummary,
        id: 'feed-2',
        title: 'Món 2',
        owner: {
          id: 'owner-2',
          displayName: 'Đặng Thu Thảo',
          avatarUrl: null,
        },
      };

      renderWithProviders(
        <div>
          <ListingCard listing={listing1} />
          <ListingCard listing={listing2} />
        </div>
      );

      const imgTri = screen.getByAltText('Ảnh đại diện của Võ Minh Trí');
      expect(imgTri).toHaveAttribute('src', 'https://example.com/tri.jpg');
      expect(screen.getByText('ĐT')).toBeInTheDocument();
    });
  });

  describe('2. Listing Detail Owner Information (ListingDetailPage)', () => {
    const mockDetailListing: ListingResponse = {
      id: 'd0000000-0000-0000-0000-000000000001',
      owner: {
        id: 'u0000000-0000-0000-0000-000000000001',
        displayName: 'Hoàng Anh Tuấn',
        avatarUrl: '/api/v1/files/tuan-avatar.jpg',
      },
      category: { id: 'cat-2', name: 'Đồ gia dụng', slug: 'home' },
      listingType: 'GIVEAWAY',
      title: 'Ấm đun nước siêu tốc',
      description: 'Ấm vẫn hoạt động tốt, tặng cho bạn nào cần.',
      price: null,
      currency: null,
      status: 'ACTIVE',
      neighborhood: 'Bình Thạnh',
      city: 'TP. Hồ Chí Minh',
      stateProvince: null,
      postalCode: null,
      country: 'Việt Nam',
      images: [],
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
      expiresAt: null,
    };

    it('renders owner custom avatar in owner information card', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockDetailListing);
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        refreshUser: vi.fn(),
      });

      renderWithProviders(
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Routes>,
        { initialEntries: [`/listings/${mockDetailListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /người đăng bài/i })).toBeInTheDocument();
      });

      const avatarImg = screen.getByAltText('Ảnh đại diện của Hoàng Anh Tuấn');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute(
        'src',
        'http://localhost:8080/api/v1/files/tuan-avatar.jpg'
      );
      expect(screen.getByRole('link', { name: 'Hoàng Anh Tuấn' })).toHaveAttribute(
        'href',
        `/users/${mockDetailListing.owner.id}`
      );
    });

    it('renders initials fallback when owner avatarUrl is null', async () => {
      const nullAvatarDetail: ListingResponse = {
        ...mockDetailListing,
        id: 'd0000000-0000-0000-0000-000000000002',
        owner: {
          id: 'u0000000-0000-0000-0000-000000000002',
          displayName: 'Ngô Bảo Châu',
          avatarUrl: null,
        },
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(nullAvatarDetail);
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        refreshUser: vi.fn(),
      });

      renderWithProviders(
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Routes>,
        { initialEntries: [`/listings/${nullAvatarDetail.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /người đăng bài/i })).toBeInTheDocument();
      });

      expect(screen.getByText('NC')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ngô Bảo Châu' })).toHaveAttribute(
        'href',
        `/users/${nullAvatarDetail.owner.id}`
      );
    });

    it('preserves public profile navigation link surrounding avatar', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockDetailListing);
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        refreshUser: vi.fn(),
      });

      renderWithProviders(
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Routes>,
        { initialEntries: [`/listings/${mockDetailListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /người đăng bài/i })).toBeInTheDocument();
      });

      const avatarLink = screen.getByRole('link', {
        name: `Xem hồ sơ của ${mockDetailListing.owner.displayName}`,
      });
      expect(avatarLink).toHaveAttribute('href', `/users/${mockDetailListing.owner.id}`);

      // Verify no extra API call was made for avatar
      expect(listingApi.getListingById).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Listing Requests UI (ListingRequestsManager)', () => {
    const mockListingForRequests: ListingResponse = {
      id: 'd0000000-0000-0000-0000-000000000003',
      owner: {
        id: 'u0000000-0000-0000-0000-000000000003',
        displayName: 'Chủ bài đăng',
        avatarUrl: '/api/v1/files/owner.jpg',
      },
      category: { id: 'c1', name: 'Đồ dùng', slug: 'items' },
      listingType: 'GIVEAWAY',
      title: 'Món đồ có yêu cầu',
      description: 'Chi tiết món đồ',
      price: null,
      currency: null,
      status: 'ACTIVE',
      neighborhood: null,
      city: 'Đà Nẵng',
      stateProvince: null,
      postalCode: null,
      country: 'Việt Nam',
      images: [],
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
      expiresAt: null,
    };

    const mockRequestWithCustomAvatar: ListingRequestResponse = {
      id: 'req-001',
      listing: {
        id: mockListingForRequests.id,
        title: mockListingForRequests.title,
        listingType: mockListingForRequests.listingType,
        status: mockListingForRequests.status,
        price: null,
        currency: null,
        city: mockListingForRequests.city,
        owner: mockListingForRequests.owner,
      },
      requester: {
        id: 'requester-001',
        displayName: 'Nguyễn Bích Ngọc',
        avatarUrl: '/api/v1/files/requester-avatar.jpg',
      },
      message: 'Em muốn xin món này ạ!',
      status: 'PENDING',
      createdAt: '2026-03-02T10:00:00Z',
      updatedAt: '2026-03-02T10:00:00Z',
    };

    const mockRequestWithGoogleAvatar: ListingRequestResponse = {
      id: 'req-002',
      listing: {
        id: mockListingForRequests.id,
        title: mockListingForRequests.title,
        listingType: mockListingForRequests.listingType,
        status: mockListingForRequests.status,
        price: null,
        currency: null,
        city: mockListingForRequests.city,
        owner: mockListingForRequests.owner,
      },
      requester: {
        id: 'requester-002',
        displayName: 'Trần Văn Hải',
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-hai',
      },
      message: 'Mình cần dùng cho công việc.',
      status: 'PENDING',
      createdAt: '2026-03-02T11:00:00Z',
      updatedAt: '2026-03-02T11:00:00Z',
    };

    const mockRequestWithNullAvatar: ListingRequestResponse = {
      id: 'req-003',
      listing: {
        id: mockListingForRequests.id,
        title: mockListingForRequests.title,
        listingType: mockListingForRequests.listingType,
        status: mockListingForRequests.status,
        price: null,
        currency: null,
        city: mockListingForRequests.city,
        owner: mockListingForRequests.owner,
      },
      requester: {
        id: 'requester-003',
        displayName: 'Lý Quốc Bảo',
        avatarUrl: null,
      },
      message: 'Xin chào bạn!',
      status: 'ACCEPTED',
      createdAt: '2026-03-02T12:00:00Z',
      updatedAt: '2026-03-02T12:00:00Z',
    };

    it('renders requester custom avatar image correctly', async () => {
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(
        createMockPageResponse([mockRequestWithCustomAvatar])
      );

      renderWithProviders(
        <ListingRequestsManager listing={mockListingForRequests} />
      );

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Bích Ngọc')).toBeInTheDocument();
      });

      const avatarImg = screen.getByAltText('Ảnh đại diện của Nguyễn Bích Ngọc');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute(
        'src',
        'http://localhost:8080/api/v1/files/requester-avatar.jpg'
      );
    });

    it('renders requester Google avatar URL correctly', async () => {
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(
        createMockPageResponse([mockRequestWithGoogleAvatar])
      );

      renderWithProviders(
        <ListingRequestsManager listing={mockListingForRequests} />
      );

      await waitFor(() => {
        expect(screen.getByText('Trần Văn Hải')).toBeInTheDocument();
      });

      const avatarImg = screen.getByAltText('Ảnh đại diện của Trần Văn Hải');
      expect(avatarImg).toBeInTheDocument();
      expect(avatarImg).toHaveAttribute(
        'src',
        'https://lh3.googleusercontent.com/a/google-hai'
      );
    });

    it('falls back to initials when requester avatarUrl is null', async () => {
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(
        createMockPageResponse([mockRequestWithNullAvatar])
      );

      renderWithProviders(
        <ListingRequestsManager listing={mockListingForRequests} />
      );

      await waitFor(() => {
        expect(screen.getByText('Lý Quốc Bảo')).toBeInTheDocument();
      });

      expect(screen.getByText('LB')).toBeInTheDocument();
      expect(screen.getByText('Đã chấp nhận')).toBeInTheDocument();
    });

    it('handles missing (undefined) requester avatar field without breaking', async () => {
      const mockRequestWithMissingAvatar: ListingRequestResponse = {
        ...mockRequestWithCustomAvatar,
        id: 'req-004',
        requester: {
          id: 'requester-004',
          displayName: 'Dương Thị Loan',
        },
      };

      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(
        createMockPageResponse([mockRequestWithMissingAvatar])
      );

      renderWithProviders(
        <ListingRequestsManager listing={mockListingForRequests} />
      );

      await waitFor(() => {
        expect(screen.getByText('Dương Thị Loan')).toBeInTheDocument();
      });

      expect(screen.getByText('DL')).toBeInTheDocument();
    });

    it('displays distinct avatars for multiple requesters and keeps actions functional', async () => {
      const user = userEvent.setup();
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(
        createMockPageResponse([mockRequestWithCustomAvatar, mockRequestWithGoogleAvatar])
      );

      renderWithProviders(
        <ListingRequestsManager listing={mockListingForRequests} />
      );

      await waitFor(() => {
        expect(screen.getByText('Nguyễn Bích Ngọc')).toBeInTheDocument();
        expect(screen.getByText('Trần Văn Hải')).toBeInTheDocument();
      });

      // Both avatars render with their respective image URLs
      expect(screen.getByAltText('Ảnh đại diện của Nguyễn Bích Ngọc')).toHaveAttribute(
        'src',
        'http://localhost:8080/api/v1/files/requester-avatar.jpg'
      );
      expect(screen.getByAltText('Ảnh đại diện của Trần Văn Hải')).toHaveAttribute(
        'src',
        'https://lh3.googleusercontent.com/a/google-hai'
      );

      // Verify accept action modal opens with requester identity clearly separated from owner
      const acceptButtons = screen.getAllByRole('button', { name: /chấp nhận/i });
      expect(acceptButtons.length).toBe(2);

      await user.click(acceptButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Chấp nhận yêu cầu này?' })).toBeInTheDocument();
      });

      expect(
        screen.getByText((content) =>
          content.includes('Bạn có chắc chắn muốn chấp nhận yêu cầu từ')
        )
      ).toBeInTheDocument();
    });
  });
});
