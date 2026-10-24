import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { transactionApi } from '@/features/transactions/api/transaction-api';
import { reviewApi } from '@/features/reviews';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { TransactionResponse } from '@/types/transaction';
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

vi.mock('@/features/reviews/api/review-api', () => ({
  reviewApi: {
    createReview: vi.fn(),
    getTransactionReviews: vi.fn().mockResolvedValue([]),
    getUserRatingSummary: vi.fn(),
    getUserReviews: vi.fn(),
  },
  reviewKeys: {
    all: ['reviews'] as const,
    ratingSummaries: () => ['reviews', 'rating-summary'] as const,
    ratingSummary: (userId: string) => ['reviews', 'rating-summary', userId] as const,
    userReviewsAll: () => ['reviews', 'user-reviews'] as const,
    userReviews: (userId: string, params?: unknown) =>
      ['reviews', 'user-reviews', userId, params] as const,
    transactionReviewsAll: () => ['reviews', 'transaction-reviews'] as const,
    transactionReviews: (transactionId: string) =>
      ['reviews', 'transaction-reviews', transactionId] as const,
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

const mockAdminUser: UserProfile = {
  id: 'admin-id',
  displayName: 'Ban Quản Trị',
  email: 'admin@shareloop.org',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockTxInProgress: TransactionResponse = {
  id: '11111111-2222-3333-4444-555555555555',
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

const mockTxRequesterPending: TransactionResponse = {
  ...mockTxInProgress,
  myRole: 'REQUESTER',
  myCompleted: false,
};

const mockTxCompleted: TransactionResponse = {
  ...mockTxInProgress,
  status: 'COMPLETED',
  requesterCompleted: true,
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockTxCancelled: TransactionResponse = {
  ...mockTxInProgress,
  status: 'CANCELLED',
  cancelledBy: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  cancelledAt: '2026-10-24T13:00:00Z',
  cancellationReason: 'Người nhận không đến lấy đúng hẹn',
  updatedAt: '2026-10-24T13:00:00Z',
};

describe('TransactionDetailPage (Phase 4B.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(transactionApi.getTransactionDetails).mockReset();
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

  it('renders invalid UUID empty state when transaction id is malformed', () => {
    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: ['/transactions/not-a-valid-uuid'] }
    );

    expect(screen.getByText('Mã giao dịch không hợp lệ')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /quay lại danh sách giao dịch/i })
    ).toBeInTheDocument();
  });

  it('renders 404 empty state when transaction is not found', async () => {
    const notFoundError = new ApiError({
      message: 'Transaction not found',
      status: 404,
      error: 'NOT_FOUND',
    });
    vi.mocked(transactionApi.getTransactionDetails).mockRejectedValueOnce(notFoundError);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy giao dịch')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Giao dịch này không tồn tại hoặc đã bị xóa khỏi hệ thống.')
    ).toBeInTheDocument();
  });

  it('renders 403 empty state when user is not authorized to view the transaction', async () => {
    const forbiddenError = new ApiError({
      message: 'Access Denied',
      status: 403,
      error: 'FORBIDDEN',
    });
    vi.mocked(transactionApi.getTransactionDetails).mockRejectedValueOnce(forbiddenError);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Bạn không phải là người tham gia hoặc không có quyền xem thông tin giao dịch này.'
      )
    ).toBeInTheDocument();
  });

  it('renders transaction details, listing info, and dual-confirmation status correctly', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxInProgress);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    // Header & metadata
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /chi tiết giao dịch/i })).toBeInTheDocument();
    });

    expect(screen.getByText(mockTxInProgress.id)).toBeInTheDocument();
    expect(screen.getByText('Đang thực hiện')).toBeInTheDocument();
    expect(screen.getByText('Bạn là Người cho / bán')).toBeInTheDocument();

    // Listing information
    expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    expect(screen.getByText('Cho tặng')).toBeInTheDocument();
    expect(screen.getByText('Hà Nội')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nồi chiên không dầu lock&lock/i })).toHaveAttribute(
      'href',
      '/listings/listing-uuid-1'
    );

    // Dual Confirmation Progress
    expect(screen.getByText('Tiến độ xác nhận bàn giao trực tiếp')).toBeInTheDocument();
    expect(screen.getAllByText('Nguyễn Văn Chủ').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Trần Thị Nhận')).toBeInTheDocument();
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument();
    expect(screen.getByText('Chưa xác nhận')).toBeInTheDocument();

    // Status explainer
    expect(
      screen.getByText(
        'Bạn đã hoàn tất xác nhận bàn giao. Đang chờ đối phương xác nhận để hoàn tất giao dịch.'
      )
    ).toBeInTheDocument();

    // Back to transactions button
    expect(screen.getByRole('button', { name: /quay lại danh sách/i })).toBeInTheDocument();
  });

  it('shows completion button for requester who has not yet confirmed, opens confirm dialog, and completes successfully', async () => {
    const user = userEvent.setup();
    let currentTx = mockTxRequesterPending;
    vi.mocked(transactionApi.getTransactionDetails).mockImplementation(async () => currentTx);
    vi.mocked(transactionApi.completeTransaction).mockImplementation(async () => {
      currentTx = mockTxCompleted;
      return mockTxCompleted;
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxRequesterPending.id}`] }
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /xác nhận bàn giao thành công/i })
      ).toBeInTheDocument();
    });

    // Click Complete button
    await user.click(screen.getByRole('button', { name: /xác nhận bàn giao thành công/i }));

    // Confirm dialog is opened
    expect(screen.getByText('Xác nhận bàn giao món đồ')).toBeInTheDocument();
    expect(
      screen.getByText(/đây là xác nhận bàn giao vật lý giữa hai người dùng/i)
    ).toBeInTheDocument();

    // Confirm action
    const confirmBtn = screen.getByRole('button', { name: /tôi đã bàn giao xong/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(transactionApi.completeTransaction).toHaveBeenCalledWith(
        mockTxRequesterPending.id
      );
    });

    // Success alert
    await waitFor(() => {
      expect(
        screen.getByText('Đã xác nhận hoàn thành bàn giao thành công!')
      ).toBeInTheDocument();
    });
  });

  it('does NOT show completion button if user already confirmed or is ADMIN', async () => {
    // Case 1: Owner who already confirmed
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValue(mockTxInProgress);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /chi tiết giao dịch/i })).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /xác nhận bàn giao thành công/i })
    ).not.toBeInTheDocument();
  });

  it('allows owner to cancel transaction with optional reason', async () => {
    const user = userEvent.setup();
    let currentTx = mockTxInProgress;
    vi.mocked(transactionApi.getTransactionDetails).mockImplementation(async () => currentTx);
    vi.mocked(transactionApi.cancelTransaction).mockImplementation(async () => {
      currentTx = mockTxCancelled;
      return mockTxCancelled;
    });

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hủy giao dịch/i })).toBeInTheDocument();
    });

    // Open cancellation modal
    await user.click(screen.getByRole('button', { name: /hủy giao dịch/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /hủy giao dịch/i })).toBeInTheDocument();
    expect(screen.getByText(/lưu ý khi hủy giao dịch/i)).toBeInTheDocument();

    // Type optional reason
    const textarea = screen.getByPlaceholderText(/người nhận không đến lấy đúng hẹn/i);
    await user.type(textarea, 'Người nhận không đến lấy đúng hẹn');

    // Submit cancellation
    const confirmCancelBtn = screen.getByRole('button', {
      name: /xác nhận hủy giao dịch/i,
    });
    await user.click(confirmCancelBtn);

    await waitFor(() => {
      expect(transactionApi.cancelTransaction).toHaveBeenCalledWith(
        mockTxInProgress.id,
        { reason: 'Người nhận không đến lấy đúng hẹn' }
      );
    });

    // Modal closed and success message visible
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Đã hủy giao dịch thành công.')).toBeInTheDocument();
    });
  });

  it('enforces mandatory cancellation reason for ADMIN role', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      user: mockAdminUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    const adminViewTx: TransactionResponse = {
      ...mockTxInProgress,
      myRole: 'ADMIN',
    };
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(adminViewTx);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${adminViewTx.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /hủy giao dịch/i })).toBeInTheDocument();
    });

    // Open cancellation modal
    await user.click(screen.getByRole('button', { name: /hủy giao dịch/i }));

    expect(screen.getByText(/bắt buộc/i)).toBeInTheDocument();

    // Submit with empty reason
    const confirmCancelBtn = screen.getByRole('button', {
      name: /xác nhận hủy giao dịch/i,
    });
    await user.click(confirmCancelBtn);

    // Error shown
    expect(
      screen.getByText('Quản trị viên bắt buộc phải nhập lý do hủy giao dịch.')
    ).toBeInTheDocument();

    expect(transactionApi.cancelTransaction).not.toHaveBeenCalled();
  });

  it('displays cancellation metadata when transaction is CANCELLED', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCancelled);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxCancelled.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Đã hủy')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Giao dịch đã bị hủy bởi Nguyễn Văn Chủ')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lý do: "Người nhận không đến lấy đúng hẹn"/)
    ).toBeInTheDocument();

    // Actions must NOT be rendered for CANCELLED transaction
    expect(screen.queryByRole('button', { name: /xác nhận bàn giao thành công/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hủy giao dịch/i })).not.toBeInTheDocument();
  });

  it('displays completed state when transaction is COMPLETED', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxCompleted.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Giao dịch đã được cả hai bên xác nhận hoàn tất. Bài đăng đã chuyển sang trạng thái đã hoàn thành.'
      )
    ).toBeInTheDocument();

    // Both steps marked confirmed
    const confirmedBadges = screen.getAllByText('Đã xác nhận');
    expect(confirmedBadges.length).toBeGreaterThanOrEqual(2);

    // Actions must NOT be rendered for COMPLETED transaction
    expect(screen.queryByRole('button', { name: /xác nhận bàn giao thành công/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hủy giao dịch/i })).not.toBeInTheDocument();
  });

  it('displays "Viết đánh giá" action for completed transaction when participant has not yet reviewed, and opens modal', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    vi.mocked(reviewApi.getTransactionReviews).mockResolvedValueOnce([]);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxCompleted.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /viết đánh giá/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/giao dịch đã hoàn tất! hãy để lại đánh giá/i)).toBeInTheDocument();

    // Clicking "Viết đánh giá" opens CreateReviewModal
    await user.click(screen.getByRole('button', { name: /viết đánh giá/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /đánh giá giao dịch/i })).toBeInTheDocument();
  });

  it('displays "Đã đánh giá" badge and rating details when participant has already reviewed', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    vi.mocked(reviewApi.getTransactionReviews).mockResolvedValueOnce([
      {
        id: 'rev-1',
        transactionId: mockTxCompleted.id,
        listing: null,
        reviewer: {
          id: mockStandardUser.id,
          displayName: mockStandardUser.displayName,
        },
        reviewee: {
          id: 'user-requester-id',
          displayName: 'Trần Thị Nhận',
        },
        rating: 5,
        comment: 'Giao dịch tuyệt vời!',
        createdAt: '2026-10-24T13:00:00Z',
      },
    ]);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxCompleted.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Đã đánh giá')).toBeInTheDocument();
    });

    expect(screen.getByText('5 sao')).toBeInTheDocument();
    expect(screen.getByText(/"Giao dịch tuyệt vời!"/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /viết đánh giá/i })).not.toBeInTheDocument();
  });

  it('does NOT display review action for incomplete or cancelled transactions or for non-participant ADMIN', async () => {
    // Case 1: In progress transaction
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxInProgress);

    renderWithProviders(
      <Routes>
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
      </Routes>,
      { initialEntries: [`/transactions/${mockTxInProgress.id}`] }
    );

    await waitFor(() => {
      expect(screen.getByText('Đang thực hiện')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /viết đánh giá/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Đã đánh giá')).not.toBeInTheDocument();
  });
});
