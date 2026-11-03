import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { useAdminTransactionDetail } from '../hooks/use-admin-transactions';
import { useTransactionProof } from '@/features/transactions/hooks/use-transaction-proof';
import { renderWithProviders } from '@/test/test-utils';
import type { TransactionResponse } from '@/types/transaction';

vi.mock('../hooks/use-admin-transactions', () => ({
  useAdminTransactionDetail: vi.fn(),
  adminTransactionQueryKeys: {
    all: ['admin-transactions'] as const,
    lists: () => ['admin-transactions', 'list'] as const,
    list: (params: unknown) => ['admin-transactions', 'list', params] as const,
    detail: (id: string) => ['admin-transactions', 'detail', id] as const,
  },
}));

vi.mock('@/features/transactions/hooks/use-transaction-proof', () => ({
  useTransactionProof: vi.fn(),
}));

const TX_ID = '11111111-2222-3333-4444-555555555555';

const mockTxCompleted: TransactionResponse = {
  id: TX_ID,
  listing: {
    id: 'listing-uuid-1',
    title: 'Nồi chiên không dầu Lock&Lock',
    listingType: 'GIVEAWAY',
    status: 'RESERVED',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: 'owner-id',
      displayName: 'Nguyễn Văn Chủ',
    },
  },
  listingRequestId: 'req-uuid-1',
  owner: {
    id: 'owner-id',
    displayName: 'Nguyễn Văn Chủ',
  },
  requester: {
    id: 'requester-id',
    displayName: 'Trần Thị Nhận',
  },
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  myRole: 'ADMIN',
  myCompleted: null,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockTxPending: TransactionResponse = {
  ...mockTxCompleted,
  status: 'PENDING',
  ownerCompleted: false,
  ownerCompletedAt: null,
  requesterCompleted: false,
  requesterCompletedAt: null,
};

const downloadProofMock = vi.fn();

function mockProofHook(overrides: Partial<ReturnType<typeof useTransactionProof>> = {}) {
  vi.mocked(useTransactionProof).mockReturnValue({
    isDownloading: false,
    error: null,
    downloadProof: downloadProofMock,
    clearError: vi.fn(),
    ...overrides,
  });
}

function renderModal(detail: TransactionResponse | undefined) {
  const onClose = vi.fn();
  vi.mocked(useAdminTransactionDetail).mockReturnValue({
    data: detail,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);

  renderWithProviders(
    <TransactionDetailModal
      transactionId={TX_ID}
      isOpen
      onClose={onClose}
    />
  );
  return { onClose };
}

describe('TransactionDetailModal — tải tài liệu xác nhận (ADMIN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadProofMock.mockResolvedValue(null);
    mockProofHook();
  });

  it('hiển thị nút "Tải tài liệu xác nhận" khi giao dịch COMPLETED', async () => {
    renderModal(mockTxCompleted);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /tải tài liệu xác nhận/i })
      ).toBeInTheDocument();
    });
  });

  it('bấm tải gọi đúng mã giao dịch và KHÔNG đóng modal', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal(mockTxCompleted);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    await user.click(button);

    await waitFor(() => {
      expect(downloadProofMock).toHaveBeenCalledTimes(1);
      expect(downloadProofMock).toHaveBeenCalledWith(TX_ID);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('hiển thị lỗi tiếng Việt khi tải thất bại, modal vẫn mở', async () => {
    mockProofHook({
      error: 'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.',
    });
    const { onClose } = renderModal(mockTxCompleted);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('không hiển thị nút khi giao dịch chưa COMPLETED', async () => {
    renderModal(mockTxPending);

    await waitFor(() => {
      expect(screen.getByText('Chờ xử lý')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: /tải tài liệu xác nhận/i })
    ).not.toBeInTheDocument();
  });

  it('vô hiệu hóa nút trong lúc đang tải', async () => {
    mockProofHook({ isDownloading: true });
    renderModal(mockTxCompleted);

    const button = await screen.findByRole('button', { name: /tải tài liệu xác nhận/i });
    expect(button).toBeDisabled();
  });
});
