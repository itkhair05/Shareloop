import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyListingsPage } from '../pages/MyListingsPage';
import { listingApi } from '../api/listing-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { ListingSummaryResponse } from '@/types/listing';
import type { PageResponse } from '@/types/api';

vi.mock('../api/listing-api', () => ({
  listingApi: {
    getMyListings: vi.fn(),
    deleteListing: vi.fn(),
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

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockListings: ListingSummaryResponse[] = [
  {
    id: 'listing-1',
    owner: { id: 'user-1', displayName: 'Nguyễn Văn A' },
    category: { id: 'cat-1', name: 'Đồ gia dụng', slug: 'home-appliances' },
    listingType: 'GIVEAWAY',
    title: 'Bộ ấm chén gốm Bát Tràng',
    price: null,
    currency: null,
    status: 'ACTIVE',
    city: 'Hà Nội',
    country: 'Việt Nam',
    primaryImageUrl: '/api/v1/files/tea-set.jpg',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'listing-2',
    owner: { id: 'user-1', displayName: 'Nguyễn Văn A' },
    category: { id: 'cat-2', name: 'Dụng cụ sửa chữa', slug: 'tools' },
    listingType: 'SALE',
    title: 'Máy khoan pin Bosch 12V',
    price: 350000,
    currency: 'VND',
    status: 'RESERVED',
    city: 'Hà Nội',
    country: 'Việt Nam',
    primaryImageUrl: null,
    createdAt: '2026-03-02T12:00:00Z',
  },
];

const createPage = (content: ListingSummaryResponse[]): PageResponse<ListingSummaryResponse> => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: content.length === 0,
});

describe('MyListingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        displayName: 'Nguyễn Văn A',
        email: 'vana@shareloop.org',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it('renders page header and listing cards with real data', async () => {
    vi.mocked(listingApi.getMyListings).mockResolvedValue(createPage(mockListings));

    renderWithProviders(<MyListingsPage />);

    expect(screen.getByRole('heading', { name: /bài đăng của tôi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng bài mới/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Bộ ấm chén gốm Bát Tràng')).toBeInTheDocument();
      expect(screen.getByText('Máy khoan pin Bosch 12V')).toBeInTheDocument();
    });

    // Check Vietnamese statuses and types
    expect(screen.getAllByText('Đang hiển thị').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đã đặt trước').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cho tặng')).toBeInTheDocument();
    expect(screen.getByText('Thanh lý')).toBeInTheDocument();
    expect(screen.getByText('Miễn phí')).toBeInTheDocument();
    expect(screen.getByText('350.000 ₫')).toBeInTheDocument();
  });

  it('filters listings by status tab', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getMyListings).mockResolvedValue(createPage(mockListings));

    renderWithProviders(<MyListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bộ ấm chén gốm Bát Tràng')).toBeInTheDocument();
    });

    // Click on "Đang hiển thị" filter tab
    const activeTab = screen.getByRole('button', { name: /^đang hiển thị$/i });
    await user.click(activeTab);

    expect(listingApi.getMyListings).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' })
    );
  });

  it('renders informative empty state when user has no listings', async () => {
    vi.mocked(listingApi.getMyListings).mockResolvedValue(createPage([]));

    renderWithProviders(<MyListingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/chưa có bài đăng nào/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /đăng bài ngay/i })).toBeInTheDocument();
    });
  });

  it('renders recoverable error state with retry button on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getMyListings).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<MyListingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/không thể tải danh sách bài đăng/i)).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /thử lại/i });
    expect(retryButton).toBeInTheDocument();

    vi.mocked(listingApi.getMyListings).mockResolvedValue(createPage(mockListings));

    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Bộ ấm chén gốm Bát Tràng')).toBeInTheDocument();
    });
  });

  it('handles delete flow: opens confirmation dialog, cancels on cancel, calls delete API on confirm', async () => {
    const user = userEvent.setup();
    vi.mocked(listingApi.getMyListings).mockResolvedValue(createPage([mockListings[0]]));
    vi.mocked(listingApi.deleteListing).mockResolvedValue();

    renderWithProviders(<MyListingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bộ ấm chén gốm Bát Tràng')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /xóa bài đăng/i });
    await user.click(deleteBtn);

    // Confirm dialog is shown
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /xác nhận xóa bài đăng/i })).toBeInTheDocument();
    expect(screen.getByText(/"Bộ ấm chén gốm Bát Tràng"/i)).toBeInTheDocument();

    // Click "Hủy"
    const cancelBtn = screen.getByRole('button', { name: /^hủy$/i });
    await user.click(cancelBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listingApi.deleteListing).not.toHaveBeenCalled();

    // Reopen and confirm deletion
    await user.click(deleteBtn);
    const confirmBtn = screen.getByRole('button', { name: /^xác nhận xóa$/i });
    await user.click(confirmBtn);

    expect(listingApi.deleteListing).toHaveBeenCalledWith('listing-1');
  });
});
