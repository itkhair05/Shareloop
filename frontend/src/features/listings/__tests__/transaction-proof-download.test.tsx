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
    downloadTransactionProof: vi.fn(),
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

const mockTxCompleted: TransactionResponse = {
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
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  myRole: 'OWNER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockTxInProgress: TransactionResponse = {
  ...mockTxCompleted,
  status: 'IN_PROGRESS',
  requesterCompleted: false,
  requesterCompletedAt: null,
  myCompleted: true,
};

const mockTxCancelled: TransactionResponse = {
  ...mockTxCompleted,
  status: 'CANCELLED',
  cancelledBy: {
    id: 'user-standard-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  cancelledAt: '2026-10-24T13:00:00Z',
  cancellationReason: 'Người nhận không đến lấy đúng hẹn',
};

function renderDetailPage(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/transactions/:id" element={<TransactionDetailPage />} />
    </Routes>,
    { initialEntries: [`/transactions/${id}`] }
  );
}

describe('TransactionDetailPage — tải tài liệu xác nhận giao dịch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(reviewApi.getTransactionReviews).mockResolvedValue([]);
  });

  it('shows the proof download button for a COMPLETED transaction participant', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);

    renderDetailPage(mockTxCompleted.id);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /tải tài liệu xác nhận/i })
      ).toBeInTheDocument();
    });
  });

  it('tải thành công: gọi API đúng mã giao dịch và hiển thị thông báo thành công', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    vi.mocked(transactionApi.downloadTransactionProof).mockResolvedValueOnce({
      blob: new Blob(['%PDF-fake'], { type: 'application/pdf' }),
      filename: `shareloop-transaction-proof-${mockTxCompleted.id}.pdf`,
    });

    renderDetailPage(mockTxCompleted.id);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    await user.click(button);

    await waitFor(() => {
      expect(transactionApi.downloadTransactionProof).toHaveBeenCalledTimes(1);
      expect(transactionApi.downloadTransactionProof).toHaveBeenCalledWith(mockTxCompleted.id);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Đã tải tài liệu xác nhận giao dịch thành công!')
      ).toBeInTheDocument();
    });
  });

  it('thất bại 409: hiển thị đúng thông báo tiếng Việt, không lộ lỗi backend thô', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    vi.mocked(transactionApi.downloadTransactionProof).mockRejectedValueOnce(
      new ApiError({
        message: 'Transaction not completed raw backend text',
        status: 409,
        error: 'Conflict',
      })
    );

    renderDetailPage(mockTxCompleted.id);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.'
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/raw backend text/i)).not.toBeInTheDocument();
  });

  it('thất bại 403: hiển thị thông báo không có quyền', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    vi.mocked(transactionApi.downloadTransactionProof).mockRejectedValueOnce(
      new ApiError({ message: 'Access Denied', status: 403, error: 'Forbidden' })
    );

    renderDetailPage(mockTxCompleted.id);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    await user.click(button);

    await waitFor(() => {
      expect(
        screen.getByText('Bạn không có quyền tải tài liệu của giao dịch này.')
      ).toBeInTheDocument();
    });
  });

  it('vô hiệu hóa nút trong lúc đang tải', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCompleted);
    let resolveDownload!: (value: { blob: Blob; filename: string }) => void;
    vi.mocked(transactionApi.downloadTransactionProof).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
    );

    renderDetailPage(mockTxCompleted.id);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tải tài liệu xác nhận/i })).toBeDisabled();
    });

    resolveDownload({ blob: new Blob(['%PDF']), filename: 'proof.pdf' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tải tài liệu xác nhận/i })).toBeEnabled();
    });
  });

  it('không hiển thị nút khi giao dịch đang IN_PROGRESS', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxInProgress);

    renderDetailPage(mockTxInProgress.id);

    await waitFor(() => {
      expect(screen.getByText('Đang thực hiện')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /tải tài liệu xác nhận/i })
    ).not.toBeInTheDocument();
  });

  it('không hiển thị nút khi giao dịch đã bị CANCELLED', async () => {
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCancelled);

    renderDetailPage(mockTxCancelled.id);

    await waitFor(() => {
      expect(screen.getByText('Đã hủy')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /tải tài liệu xác nhận/i })
    ).not.toBeInTheDocument();
  });

  it('không hiển thị nút cho ADMIN không phải người tham gia dù giao dịch COMPLETED', async () => {
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
    const adminViewTx: TransactionResponse = { ...mockTxCompleted, myRole: 'ADMIN' };
    vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(adminViewTx);

    renderDetailPage(adminViewTx.id);

    await waitFor(() => {
      expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /tải tài liệu xác nhận/i })
    ).not.toBeInTheDocument();
    expect(transactionApi.downloadTransactionProof).not.toHaveBeenCalled();
  });
});
