import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { ListingDetailPage } from '../pages/ListingDetailPage';
import { listingApi } from '../api/listing-api';
import { requestApi } from '@/features/requests/api/request-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { ListingResponse } from '@/types/listing';
import type { ListingRequestResponse } from '@/types/request';
import type { UserProfile } from '@/types/auth';
import type { PageResponse } from '@/types/api';
import { ApiError } from '@/lib/api-error';

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
    mines: () => ['listings', 'mine'] as const,
    mine: (params: unknown) => ['listings', 'mine', params] as const,
  },
}));

vi.mock('@/features/requests/api/request-api', () => ({
  requestApi: {
    createRequest: vi.fn(),
    getRequestsForListing: vi.fn(),
    getMyRequests: vi.fn(),
    updateRequestStatus: vi.fn(),
  },
  requestKeys: {
    all: ['requests'] as const,
    mineLists: () => ['requests', 'mine'] as const,
    mine: (params: unknown) => ['requests', 'mine', params] as const,
    listingLists: () => ['requests', 'listing'] as const,
    listing: (listingId: string, params?: unknown) =>
      ['requests', 'listing', listingId, params] as const,
  },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockGiveawayListing: ListingResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  owner: {
    id: 'owner-uuid-1',
    displayName: 'Nguyễn Văn Chủ Nhà',
  },
  category: {
    id: 'c1',
    name: 'Đồ dùng gia đình',
    slug: 'household',
  },
  listingType: 'GIVEAWAY',
  title: 'Nồi chiên không dầu Lock&Lock tặng miễn phí',
  description: 'Nồi còn dùng rất tốt, dung tích 5 lít.',
  price: null,
  currency: null,
  status: 'ACTIVE',
  neighborhood: 'Cầu Giấy',
  city: 'Hà Nội',
  stateProvince: null,
  postalCode: null,
  country: 'Việt Nam',
  images: [{ id: 'img-1', imageUrl: '/files/airfryer.jpg', sortOrder: 0 }],
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-01T10:00:00Z',
  expiresAt: null,
};

const mockSaleListing: ListingResponse = {
  ...mockGiveawayListing,
  id: '22222222-2222-2222-2222-222222222222',
  listingType: 'SALE',
  title: 'Bàn phím cơ DareU thanh lý giá rẻ',
  price: 250000,
  currency: 'VND',
};

const mockWantedListing: ListingResponse = {
  ...mockGiveawayListing,
  id: '33333333-3333-3333-3333-333333333333',
  listingType: 'WANTED',
  title: 'Cần tìm sách giáo khoa lớp 10',
  price: 100000,
  currency: 'VND',
};

const mockStandardUser: UserProfile = {
  id: 'requester-uuid-2',
  displayName: 'Trần Thị Người Nhận',
  email: 'requester@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockOwnerUser: UserProfile = {
  id: 'owner-uuid-1',
  displayName: 'Nguyễn Văn Chủ Nhà',
  email: 'owner@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const emptyPageResponse: PageResponse<ListingRequestResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('Listing Request UI Integration (Phase 4A.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestApi.getMyRequests).mockResolvedValue(emptyPageResponse);
    vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(emptyPageResponse);
  });

  describe('Feature A: Request Actions on ListingDetailPage', () => {
    it('renders "Tôi muốn nhận món này" CTA for active GIVEAWAY listing for authenticated non-owner', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        const primaryBtn = screen.getByRole('button', { name: /tôi muốn nhận món này/i });
        expect(primaryBtn).toBeInTheDocument();
        expect(primaryBtn).toHaveClass('flex', 'flex-row', 'items-center', 'justify-center', 'gap-2');
        expect(primaryBtn.className).toContain('[&>span]:flex');
        expect(primaryBtn.className).toContain('[&>span]:flex-row');
        expect(primaryBtn.className).toContain('[&>span]:items-center');
      });
    });

    it('renders "Đề nghị mua" CTA for active SALE listing for authenticated non-owner', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockSaleListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockSaleListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /đề nghị mua/i })).toBeInTheDocument();
      });
    });

    it('does NOT render request action for WANTED listing', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockWantedListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockWantedListing.id}`] }
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: mockWantedListing.title })
        ).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /tôi muốn nhận món này/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /đề nghị mua/i })).not.toBeInTheDocument();
    });

    it('renders "Bạn là người đăng bài này" for the listing owner and no request action', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText(/bạn là người đăng bài này/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /tôi muốn nhận món này/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /chỉnh sửa/i })).toHaveAttribute(
        'href',
        `/listings/${mockGiveawayListing.id}/edit`
      );
    });

    it('does NOT show request action for inactive listings (e.g. RESERVED, COMPLETED)', async () => {
      const reservedListing: ListingResponse = {
        ...mockGiveawayListing,
        status: 'RESERVED',
      };
      vi.mocked(listingApi.getListingById).mockResolvedValue(reservedListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${reservedListing.id}`] }
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: reservedListing.title })
        ).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /tôi muốn nhận món này/i })).not.toBeInTheDocument();
    });

    it('renders login prompt button for unauthenticated users', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /đăng nhập để nhận món này/i })).toBeInTheDocument();
      });
    });

    it('displays "Yêu cầu đang chờ phản hồi" when user already has a pending request for the listing', async () => {
      const myPendingRequest: ListingRequestResponse = {
        id: 'req-1',
        listing: {
          id: mockGiveawayListing.id,
          title: mockGiveawayListing.title,
          listingType: mockGiveawayListing.listingType,
          status: mockGiveawayListing.status,
          price: null,
          currency: null,
          city: mockGiveawayListing.city,
          owner: mockGiveawayListing.owner,
        },
        requester: {
          id: mockStandardUser.id,
          displayName: mockStandardUser.displayName,
        },
        message: 'Mình rất cần món này',
        status: 'PENDING',
        createdAt: '2026-03-02T12:00:00Z',
        updatedAt: '2026-03-02T12:00:00Z',
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getMyRequests).mockResolvedValue({
        ...emptyPageResponse,
        content: [myPendingRequest],
        totalElements: 1,
      });

      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText(/yêu cầu đang chờ phản hồi/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /tôi muốn nhận món này/i })).not.toBeInTheDocument();
    });

    it('opens CreateRequestModal, allows typing message with character counter, and submits successfully', async () => {
      const user = userEvent.setup();
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        refreshUser: vi.fn(),
      });

      const createdResponse: ListingRequestResponse = {
        id: 'new-req-uuid',
        listing: {
          id: mockGiveawayListing.id,
          title: mockGiveawayListing.title,
          listingType: mockGiveawayListing.listingType,
          status: mockGiveawayListing.status,
          price: null,
          currency: null,
          city: mockGiveawayListing.city,
          owner: mockGiveawayListing.owner,
        },
        requester: {
          id: mockStandardUser.id,
          displayName: mockStandardUser.displayName,
        },
        message: 'Mình có thể qua lấy chiều mai',
        status: 'PENDING',
        createdAt: '2026-03-02T14:00:00Z',
        updatedAt: '2026-03-02T14:00:00Z',
      };
      vi.mocked(requestApi.createRequest).mockResolvedValue(createdResponse);

      renderWithProviders(
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Routes>,
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /tôi muốn nhận món này/i })).toBeInTheDocument();
      });

      // Click to open modal
      await user.click(screen.getByRole('button', { name: /tôi muốn nhận món này/i }));

      // Modal dialog is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /gửi yêu cầu nhận món đồ/i })).toBeInTheDocument();

      // Check character counter initially 0/1000
      expect(screen.getByText('0/1000')).toBeInTheDocument();

      // Type a message
      const textarea = screen.getByPlaceholderText(/chào bạn, mình rất muốn nhận món đồ này/i);
      await user.type(textarea, 'Mình có thể qua lấy chiều mai');
      expect(screen.getByText('29/1000')).toBeInTheDocument();

      // Submit modal form
      const modalSubmitBtn = screen.getByRole('button', { name: /gửi yêu cầu nhận đồ/i });
      expect(modalSubmitBtn).toHaveClass('flex', 'flex-row', 'items-center', 'justify-center', 'gap-2');
      expect(modalSubmitBtn.className).toContain('[&>span]:flex');
      expect(modalSubmitBtn.className).toContain('[&>span]:flex-row');
      expect(modalSubmitBtn.className).toContain('[&>span]:items-center');
      await user.click(modalSubmitBtn);

      await waitFor(() => {
        expect(requestApi.createRequest).toHaveBeenCalledWith(
          mockGiveawayListing.id,
          { message: 'Mình có thể qua lấy chiều mai' }
        );
      });

      // Modal closes and success banner appears
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText(/đã gửi yêu cầu nhận món đồ thành công/i)).toBeInTheDocument();
      });
    });

    it('transitions to "Yêu cầu đang chờ phản hồi" when submission encounters a 409 conflict (out-of-page pending request)', async () => {
      const user = userEvent.setup();
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getMyRequests).mockResolvedValue(emptyPageResponse);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        clearError: vi.fn(),
        refreshUser: vi.fn(),
      });

      // Simulate 409 conflict returned by backend
      const conflictError = new ApiError({
        message: 'Bạn đã gửi yêu cầu cho món đồ này rồi',
        status: 409,
        error: 'CONFLICT',
      });
      vi.mocked(requestApi.createRequest).mockRejectedValue(conflictError);

      renderWithProviders(
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
        </Routes>,
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /tôi muốn nhận món này/i })).toBeInTheDocument();
      });

      // Open modal
      await user.click(screen.getByRole('button', { name: /tôi muốn nhận món này/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Submit
      await user.click(screen.getByRole('button', { name: /gửi yêu cầu nhận đồ/i }));

      // Conflict error alert is displayed in modal
      await waitFor(() => {
        expect(
          screen.getByText(/bạn đã có một yêu cầu đang chờ phản hồi cho bài đăng này/i)
        ).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByRole('button', { name: /^hủy$/i }));

      // Detail page now permanently reflects hasConflictPendingRequest = true
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByText(/yêu cầu đang chờ phản hồi/i)).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /tôi muốn nhận món này/i })).not.toBeInTheDocument();
    });
  });

  describe('Feature B: Owner Request Management (ListingRequestsManager)', () => {
    it('shows ListingRequestsManager for listing owner with incoming requests and accept/reject actions', async () => {
      const user = userEvent.setup();
      const mockRequest1: ListingRequestResponse = {
        id: 'req-item-1',
        listing: {
          id: mockGiveawayListing.id,
          title: mockGiveawayListing.title,
          listingType: mockGiveawayListing.listingType,
          status: mockGiveawayListing.status,
          price: null,
          currency: null,
          city: mockGiveawayListing.city,
          owner: mockGiveawayListing.owner,
        },
        requester: {
          id: 'requester-abc',
          displayName: 'Lê Văn C',
        },
        message: 'Mình là sinh viên, rất muốn xin món này để dùng.',
        status: 'PENDING',
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z',
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue({
        ...emptyPageResponse,
        content: [mockRequest1],
        totalElements: 1,
        totalPages: 1,
      });

      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      // Section header visible
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /yêu cầu từ cộng đồng/i })).toBeInTheDocument();
      });

      // Wait for requester info and message to load
      await waitFor(() => {
        expect(screen.getByText('Lê Văn C')).toBeInTheDocument();
      });

      expect(screen.getByText(/"Mình là sinh viên, rất muốn xin món này để dùng\."/)).toBeInTheDocument();
      expect(screen.getByText('Chờ phản hồi')).toBeInTheDocument();

      // Action buttons available
      const acceptBtn = screen.getByRole('button', { name: /chấp nhận/i });
      const rejectBtn = screen.getByRole('button', { name: /từ chối/i });
      expect(acceptBtn).toBeInTheDocument();
      expect(rejectBtn).toBeInTheDocument();
      expect(acceptBtn).toHaveClass('flex', 'flex-row', 'items-center', 'justify-center', 'gap-2');
      expect(acceptBtn.className).toContain('[&>span]:flex');
      expect(rejectBtn).toHaveClass('flex', 'flex-row', 'items-center', 'justify-center', 'gap-2');
      expect(rejectBtn.className).toContain('[&>span]:flex');

      // Click Accept opens confirmation dialog
      await user.click(acceptBtn);
      expect(screen.getByText(/bạn có chắc chắn muốn chấp nhận yêu cầu từ/i)).toBeInTheDocument();

      // Confirm accept
      vi.mocked(requestApi.updateRequestStatus).mockResolvedValue({
        ...mockRequest1,
        status: 'ACCEPTED',
      });

      const confirmBtn = screen.getByRole('button', { name: /chấp nhận yêu cầu/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(requestApi.updateRequestStatus).toHaveBeenCalledWith('req-item-1', {
          status: 'ACCEPTED',
        });
      });
    });

    it('allows owner to reject a pending request via confirmation dialog', async () => {
      const user = userEvent.setup();
      const mockRequestReject: ListingRequestResponse = {
        id: 'req-item-reject',
        listing: {
          id: mockGiveawayListing.id,
          title: mockGiveawayListing.title,
          listingType: mockGiveawayListing.listingType,
          status: mockGiveawayListing.status,
          price: null,
          currency: null,
          city: mockGiveawayListing.city,
          owner: mockGiveawayListing.owner,
        },
        requester: {
          id: 'requester-xyz',
          displayName: 'Trần Thị B',
        },
        message: 'Em muốn xin món này ạ',
        status: 'PENDING',
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z',
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue({
        ...emptyPageResponse,
        content: [mockRequestReject],
        totalElements: 1,
        totalPages: 1,
      });

      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
      });

      const rejectBtn = screen.getByRole('button', { name: /từ chối/i });
      await user.click(rejectBtn);

      // Confirm dialog opens
      expect(screen.getByText(/bạn có chắc chắn muốn từ chối yêu cầu từ/i)).toBeInTheDocument();

      vi.mocked(requestApi.updateRequestStatus).mockResolvedValue({
        ...mockRequestReject,
        status: 'REJECTED',
      });

      const confirmRejectBtn = screen.getByRole('button', { name: /từ chối yêu cầu/i });
      await user.click(confirmRejectBtn);

      await waitFor(() => {
        expect(requestApi.updateRequestStatus).toHaveBeenCalledWith('req-item-reject', {
          status: 'REJECTED',
        });
      });
    });

    it('does NOT show ListingRequestsManager to regular non-owner users', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(useAuth).mockReturnValue({
        user: mockStandardUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: mockGiveawayListing.title })
        ).toBeInTheDocument();
      });

      // Requests manager section must not be rendered for non-owner
      expect(screen.queryByRole('heading', { name: /yêu cầu từ cộng đồng/i })).not.toBeInTheDocument();
    });

    it('disables "Chấp nhận" button and shows warning when listing is RESERVED', async () => {
      const reservedListing: ListingResponse = {
        ...mockGiveawayListing,
        status: 'RESERVED',
      };
      const pendingRequest: ListingRequestResponse = {
        id: 'req-item-2',
        listing: {
          id: reservedListing.id,
          title: reservedListing.title,
          listingType: reservedListing.listingType,
          status: reservedListing.status,
          price: null,
          currency: null,
          city: reservedListing.city,
          owner: reservedListing.owner,
        },
        requester: {
          id: 'user-xyz',
          displayName: 'Phạm Thị D',
        },
        message: null,
        status: 'PENDING',
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z',
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(reservedListing);
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue({
        ...emptyPageResponse,
        content: [pendingRequest],
        totalElements: 1,
        totalPages: 1,
      });

      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${reservedListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /yêu cầu từ cộng đồng/i })).toBeInTheDocument();
      });

      // Warning banner displayed
      expect(screen.getByText(/bài đăng hiện ở trạng thái/i)).toBeInTheDocument();

      // Wait for request item to load
      await waitFor(() => {
        expect(screen.getByText('Phạm Thị D')).toBeInTheDocument();
      });

      // Accept button is disabled because listing is not ACTIVE
      const acceptBtn = screen.getByRole('button', { name: /chấp nhận/i });
      expect(acceptBtn).toBeDisabled();
    });

    it('renders empty state when there are no incoming requests for the listing', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getRequestsForListing).mockResolvedValue(emptyPageResponse);
      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText('Chưa có yêu cầu nào')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Bài đăng này hiện chưa nhận được yêu cầu nào từ người dùng khác.')
      ).toBeInTheDocument();
    });

    it('renders error alert with retry button when fetching requests fails', async () => {
      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getRequestsForListing).mockRejectedValue(
        new Error('Network error loading requests')
      );
      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText(/không thể tải danh sách yêu cầu/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /tải lại/i })).toBeInTheDocument();
    });

    it('renders pagination controls when totalPages > 1 and navigates between pages', async () => {
      const user = userEvent.setup();
      const mockRequestPage0: ListingRequestResponse = {
        id: 'req-p0',
        listing: {
          id: mockGiveawayListing.id,
          title: mockGiveawayListing.title,
          listingType: mockGiveawayListing.listingType,
          status: mockGiveawayListing.status,
          price: null,
          currency: null,
          city: mockGiveawayListing.city,
          owner: mockGiveawayListing.owner,
        },
        requester: { id: 'u1', displayName: 'Người dùng 1' },
        message: 'Lời nhắn 1',
        status: 'PENDING',
        createdAt: '2026-03-02T10:00:00Z',
        updatedAt: '2026-03-02T10:00:00Z',
      };

      const mockRequestPage1: ListingRequestResponse = {
        ...mockRequestPage0,
        id: 'req-p1',
        requester: { id: 'u2', displayName: 'Người dùng 2' },
        message: 'Lời nhắn 2',
      };

      vi.mocked(listingApi.getListingById).mockResolvedValue(mockGiveawayListing);
      vi.mocked(requestApi.getRequestsForListing)
        .mockResolvedValueOnce({
          content: [mockRequestPage0],
          totalElements: 6,
          totalPages: 2,
          size: 5,
          number: 0,
          first: true,
          last: false,
          empty: false,
        })
        .mockResolvedValueOnce({
          content: [mockRequestPage1],
          totalElements: 6,
          totalPages: 2,
          size: 5,
          number: 1,
          first: false,
          last: true,
          empty: false,
        });

      vi.mocked(useAuth).mockReturnValue({
        user: mockOwnerUser,
        isAuthenticated: true,
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
        { initialEntries: [`/listings/${mockGiveawayListing.id}`] }
      );

      await waitFor(() => {
        expect(screen.getByText('Người dùng 1')).toBeInTheDocument();
      });

      expect(screen.getByText(/Trang 1 \/ 2/)).toBeInTheDocument();

      // Click Next page
      const nextBtn = screen.getByRole('button', { name: /trang kế tiếp/i });
      expect(nextBtn).toBeEnabled();
      await user.click(nextBtn);

      await waitFor(() => {
        expect(screen.getByText('Người dùng 2')).toBeInTheDocument();
      });

      expect(screen.getByText(/Trang 2 \/ 2/)).toBeInTheDocument();
    });
  });
});
