import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { transactionApi } from '@/features/transactions/api/transaction-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { TransactionResponse } from '@/types/transaction';
import type { PageResponse } from '@/types/api';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/transactions/api/transaction-api', () => ({
  transactionApi: {
    getUserTransactions: vi.fn(),
    getTransactionDetails: vi.fn(),
    getListingTransaction: vi.fn(),
    completeTransaction: vi.fn(),
    cancelTransaction: vi.fn(),
  },
  transactionKeys: {
    all: ['transactions'] as const,
    lists: () => ['transactions', 'list'] as const,
    list: (params: unknown) => ['transactions', 'list', params] as const,
    details: () => ['transactions', 'detail'] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
    listings: () => ['transactions', 'listing'] as const,
    listing: (listingId: string) => ['transactions', 'listing', listingId] as const,
  },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockStandardUser: UserProfile = {
  id: 'user-standard-id',
  displayName: 'Nguyễn Văn Chủ',
  email: 'user@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockTx1: TransactionResponse = {
  id: 'tx-uuid-1111-1111-1111-111111111111',
  listing: {
    id: 'listing-uuid-1',
    title: 'Nồi chiên không dầu Lock&Lock',
    listingType: 'GIVEAWAY',
    status: 'RESERVED',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: 'user-standard-id',
      displayName: 'Nguyễn Văn Chủ',
    },
  },
  listingRequestId: 'req-uuid-1',
  owner: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  requester: {
    id: 'user-requester-id',
    displayName: 'Trần Thị Nhận',
  },
  status: 'IN_PROGRESS',
  ownerCompleted: true,
  requesterCompleted: false,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: null,
  myRole: 'OWNER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
};

const mockTx2: TransactionResponse = {
  id: 'tx-uuid-2222-2222-2222-222222222222',
  listing: {
    id: 'listing-uuid-2',
    title: 'Bàn phím cơ DareU EK87 thanh lý',
    listingType: 'SALE',
    status: 'COMPLETED',
    price: 250000,
    currency: 'VND',
    city: 'Đà Nẵng',
    owner: {
      id: 'other-owner-id',
      displayName: 'Lê Văn Bán',
    },
  },
  listingRequestId: 'req-uuid-2',
  owner: {
    id: 'other-owner-id',
    displayName: 'Lê Văn Bán',
  },
  requester: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-23T15:00:00Z',
  requesterCompletedAt: '2026-10-23T15:30:00Z',
  myRole: 'REQUESTER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-23T10:00:00Z',
  updatedAt: '2026-10-23T15:30:00Z',
};

const mockTxCancelled: TransactionResponse = {
  id: 'tx-uuid-3333-3333-3333-333333333333',
  listing: {
    id: 'listing-uuid-3',
    title: 'Quạt đứng Panasonic',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: null,
    currency: 'VND',
    city: 'TP Hồ Chí Minh',
    owner: {
      id: 'user-standard-id',
      displayName: 'Nguyễn Văn Chủ',
    },
  },
  listingRequestId: 'req-uuid-3',
  owner: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  requester: {
    id: 'cancelled-user-id',
    displayName: 'Phạm Văn Hủy',
  },
  status: 'CANCELLED',
  ownerCompleted: false,
  requesterCompleted: false,
  ownerCompletedAt: null,
  requesterCompletedAt: null,
  myRole: 'OWNER',
  myCompleted: false,
  cancelledBy: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  cancelledAt: '2026-10-24T14:00:00Z',
  cancellationReason: 'Người nhận không đến lấy đúng hẹn',
  createdAt: '2026-10-24T08:00:00Z',
  updatedAt: '2026-10-24T14:00:00Z',
};

const emptyPageResponse: PageResponse<TransactionResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('TransactionsPage (Phase 4B.2 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionApi.getUserTransactions).mockReset();
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
  });

  it('renders page header, badges, and real transaction cards with dual confirmation status', async () => {
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce({
      content: [mockTx1, mockTx2],
      totalElements: 2,
      totalPages: 1,
      size: 10,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    // Header & subtitle
    expect(screen.getByRole('heading', { level: 1, name: /giao dịch của tôi/i })).toBeInTheDocument();
    expect(
      screen.getByText(/theo dõi tiến độ trao đổi, nhận và bàn giao đồ dùng cộng đồng/i)
    ).toBeInTheDocument();

    // Total elements badge
    await waitFor(() => {
      expect(screen.getByText('2 giao dịch')).toBeInTheDocument();
    });

    // Transaction 1 details
    expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    expect(screen.getAllByText('Đang thực hiện').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bạn là Người cho / bán')).toBeInTheDocument();
    expect(screen.getByText(/Hà Nội/)).toBeInTheDocument();
    expect(
      screen.getByText('Bạn đã xác nhận bàn giao. Đang chờ đối phương xác nhận để hoàn tất giao dịch.')
    ).toBeInTheDocument();

    // Transaction 2 details
    expect(screen.getByText('Bàn phím cơ DareU EK87 thanh lý')).toBeInTheDocument();
    expect(screen.getAllByText('Đã hoàn tất').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Bạn là Người nhận / mua')).toBeInTheDocument();
    expect(screen.getByText(/250.000/)).toBeInTheDocument();
    expect(
      screen.getByText('Giao dịch đã được cả hai bên xác nhận hoàn tất thành công.')
    ).toBeInTheDocument();

    // Functional links to listings
    const listingLinks = screen.getAllByRole('link', { name: /xem bài đăng/i });
    expect(listingLinks).toHaveLength(2);
    expect(listingLinks[0]).toHaveAttribute('href', '/listings/listing-uuid-1');
    expect(listingLinks[1]).toHaveAttribute('href', '/listings/listing-uuid-2');
  });

  it('filters transactions by status when clicking status tabs', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValue({
      content: [mockTx1],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });

    // Click "Đang thực hiện" tab
    const inProgressTab = screen.getByRole('button', { name: 'Đang thực hiện' });
    await user.click(inProgressTab);

    await waitFor(() => {
      expect(transactionApi.getUserTransactions).toHaveBeenCalledWith({
        status: 'IN_PROGRESS',
        role: undefined,
        page: 0,
        size: 10,
      });
    });

    // Click "Đã hoàn tất" tab
    const completedTab = screen.getByRole('button', { name: 'Đã hoàn tất' });
    await user.click(completedTab);

    await waitFor(() => {
      expect(transactionApi.getUserTransactions).toHaveBeenCalledWith({
        status: 'COMPLETED',
        role: undefined,
        page: 0,
        size: 10,
      });
    });

    // Click "Tất cả" tab to reset status
    const allTab = screen.getByRole('button', { name: 'Tất cả' });
    await user.click(allTab);

    await waitFor(() => {
      expect(transactionApi.getUserTransactions).toHaveBeenCalledWith({
        status: undefined,
        role: undefined,
        page: 0,
        size: 10,
      });
    });
  });

  it('filters transactions by participant role when clicking role buttons', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValue({
      content: [mockTx1],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });

    // Click "Tôi cho / bán" role filter
    const ownerBtn = screen.getByRole('button', { name: 'Tôi cho / bán' });
    await user.click(ownerBtn);

    await waitFor(() => {
      expect(transactionApi.getUserTransactions).toHaveBeenCalledWith({
        status: undefined,
        role: 'owner',
        page: 0,
        size: 10,
      });
    });

    // Click "Tôi nhận / mua" role filter
    const requesterBtn = screen.getByRole('button', { name: 'Tôi nhận / mua' });
    await user.click(requesterBtn);

    await waitFor(() => {
      expect(transactionApi.getUserTransactions).toHaveBeenCalledWith({
        status: undefined,
        role: 'requester',
        page: 0,
        size: 10,
      });
    });
  });

  it('displays cancelled transaction details and cancellation reason', async () => {
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce({
      content: [mockTxCancelled],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Quạt đứng Panasonic')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Đã hủy').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/bởi Nguyễn Văn Chủ/)).toBeInTheDocument();
    expect(
      screen.getByText(/Lý do: "Người nhận không đến lấy đúng hẹn"/)
    ).toBeInTheDocument();
  });

  it('handles pagination and navigates between pages', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getUserTransactions)
      .mockResolvedValueOnce({
        content: [mockTx1],
        totalElements: 15,
        totalPages: 2,
        size: 10,
        number: 0,
        first: true,
        last: false,
        empty: false,
      })
      .mockResolvedValueOnce({
        content: [mockTx2],
        totalElements: 15,
        totalPages: 2,
        size: 10,
        number: 1,
        first: false,
        last: true,
        empty: false,
      });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });

    // Pagination label
    expect(screen.getByText(/Trang 1 \/ 2/)).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /trang trước/i });
    const nextBtn = screen.getByRole('button', { name: /trang kế tiếp/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click next page
    await user.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ DareU EK87 thanh lý')).toBeInTheDocument();
    });

    expect(screen.getByText(/Trang 2 \/ 2/)).toBeInTheDocument();
  });

  it('displays empty state when user has no transactions and provides navigation to explore', async () => {
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce(emptyPageResponse);

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Bạn chưa có giao dịch nào')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Khi bạn chấp nhận chia sẻ món đồ hoặc được chủ bài đăng chấp nhận yêu cầu, giao dịch sẽ xuất hiện tại đây.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /khám phá bài đăng/i })).toBeInTheDocument();
  });

  it('displays filter-empty state and allows resetting filters', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getUserTransactions)
      .mockResolvedValueOnce({
        content: [mockTx1],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
        first: true,
        last: true,
        empty: false,
      })
      .mockResolvedValueOnce(emptyPageResponse)
      .mockResolvedValueOnce({
        content: [mockTx1],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });

    // Select status filter that yields 0 results
    await user.click(screen.getByRole('button', { name: 'Đã hủy' }));

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy giao dịch phù hợp')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Không có giao dịch nào khớp với bộ lọc trạng thái hoặc vai trò bạn đã chọn.'
      )
    ).toBeInTheDocument();

    // Click Reset filters button
    const resetBtn = screen.getByRole('button', { name: /đặt lại bộ lọc/i });
    await user.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });
  });

  it('renders recoverable error state with retry button on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getUserTransactions)
      .mockRejectedValueOnce(new Error('Mất kết nối mạng'))
      .mockResolvedValueOnce({
        content: [mockTx1],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách giao dịch')).toBeInTheDocument();
    });

    expect(screen.getByText('Mất kết nối mạng')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });
  });

  it('renders Quản trị viên badge when user myRole is ADMIN', async () => {
    const adminTx: TransactionResponse = {
      ...mockTx1,
      myRole: 'ADMIN',
    };
    vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce({
      content: [adminTx],
      totalElements: 1,
      totalPages: 1,
      size: 10,
      number: 0,
      first: true,
      last: true,
      empty: false,
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>,
      { initialEntries: ['/transactions'] }
    );

    await waitFor(() => {
      expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
    });
  });
});
