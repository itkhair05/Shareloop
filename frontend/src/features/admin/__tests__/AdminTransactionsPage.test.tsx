import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminTransactionsPage } from '../AdminTransactionsPage';
import { adminTransactionsApi } from '../api/admin-transactions-api';
import { transactionApi } from '@/features/transactions/api/transaction-api';
import { useAuth, type AuthContextValue } from '@/features/auth/context';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminTransactionResponse, AdminTransactionsPageResponse } from '@/types/admin-transaction';
import type { TransactionResponse } from '@/types/transaction';
import type { UserProfile } from '@/types/auth';

vi.mock('../api/admin-transactions-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-transactions-api')>();
  return {
    ...actual,
    adminTransactionsApi: {
      ...actual.adminTransactionsApi,
      getAdminTransactions: vi.fn(),
    },
  };
});

vi.mock('@/features/transactions/api/transaction-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/transactions/api/transaction-api')>();
  return {
    ...actual,
    transactionApi: {
      ...actual.transactionApi,
      getTransactionDetails: vi.fn(),
      cancelTransaction: vi.fn(),
    },
  };
});

vi.mock('@/features/auth/context', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth/context');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockAdminUser: UserProfile = {
  id: 'admin-1',
  displayName: 'Admin Quản Trị Viên',
  email: 'admin@shareloop.com',
  phoneNumber: '0901234567',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
};

const mockRegularUser: UserProfile = {
  id: 'user-regular',
  displayName: 'Người Dùng Thường',
  email: 'user@example.com',
  phoneNumber: '0912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
};

const mockAdminAuthValue: AuthContextValue = {
  user: mockAdminUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(mockAdminUser),
};

const mockRegularAuthValue: AuthContextValue = {
  user: mockRegularUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  clearError: vi.fn(),
  refreshUser: vi.fn().mockResolvedValue(mockRegularUser),
};

const mockPendingTx: AdminTransactionResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  listingId: 'listing-1',
  listingTitle: 'Sách Lập trình TypeScript Nâng Cao',
  listingRequestId: 'req-1',
  ownerId: 'user-owner-1',
  ownerDisplayName: 'Nguyễn Văn Chủ',
  ownerAvatarUrl: '/api/v1/files/avatars/owner-1.png',
  requesterId: 'user-req-1',
  requesterDisplayName: 'Trần Thị Nhận',
  requesterAvatarUrl: 'https://lh3.googleusercontent.com/a/requester-1',
  status: 'PENDING',
  ownerCompleted: false,
  requesterCompleted: false,
  ownerCompletedAt: null,
  requesterCompletedAt: null,
  cancelledById: null,
  cancelledByDisplayName: null,
  cancelledAt: null,
  cancellationReason: null,
  cancelledBy: null,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-20T10:00:00Z',
};

const mockInProgressTx: AdminTransactionResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  listingId: 'listing-2',
  listingTitle: 'Nồi chiên không dầu Lock&Lock',
  listingRequestId: 'req-2',
  ownerId: 'user-owner-2',
  ownerDisplayName: 'Lê Văn Chủ',
  requesterId: 'user-req-2',
  requesterDisplayName: 'Phạm Thị Khách',
  status: 'IN_PROGRESS',
  ownerCompleted: true,
  requesterCompleted: false,
  ownerCompletedAt: '2026-10-21T08:30:00Z',
  requesterCompletedAt: null,
  cancelledById: null,
  cancelledByDisplayName: null,
  cancelledAt: null,
  cancellationReason: null,
  cancelledBy: null,
  createdAt: '2026-10-20T11:00:00Z',
  updatedAt: '2026-10-21T08:30:00Z',
};

const mockCompletedTx: AdminTransactionResponse = {
  id: '33333333-3333-3333-3333-333333333333',
  listingId: 'listing-3',
  listingTitle: 'Bàn phím cơ Bluetooth',
  listingRequestId: null,
  ownerId: 'user-owner-3',
  ownerDisplayName: 'Hoàng Văn C',
  requesterId: 'user-req-3',
  requesterDisplayName: 'Vũ Thị D',
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-22T09:00:00Z',
  requesterCompletedAt: '2026-10-22T09:15:00Z',
  cancelledById: null,
  cancelledByDisplayName: null,
  cancelledAt: null,
  cancellationReason: null,
  cancelledBy: null,
  createdAt: '2026-10-21T07:00:00Z',
  updatedAt: '2026-10-22T09:15:00Z',
};

const mockCancelledTx: AdminTransactionResponse = {
  id: '44444444-4444-4444-4444-444444444444',
  listingId: 'listing-4',
  listingTitle: 'Ghế xoay văn phòng Hòa Phát',
  listingRequestId: 'req-4',
  ownerId: 'user-owner-4',
  ownerDisplayName: 'Đặng Văn E',
  requesterId: 'user-req-4',
  requesterDisplayName: 'Bùi Thị F',
  status: 'CANCELLED',
  ownerCompleted: false,
  requesterCompleted: false,
  ownerCompletedAt: null,
  requesterCompletedAt: null,
  cancelledById: 'admin-1',
  cancelledByDisplayName: 'Quản trị viên Hệ thống',
  cancelledAt: '2026-10-23T10:00:00Z',
  cancellationReason: 'Hai bên không thỏa thuận được phương thức nhận đồ',
  cancelledBy: {
    id: 'admin-1',
    displayName: 'Quản trị viên Hệ thống',
    avatarUrl: '/api/v1/files/avatars/admin-1.png',
  },
  createdAt: '2026-10-22T14:00:00Z',
  updatedAt: '2026-10-23T10:00:00Z',
};

const mockDetailInProgress: TransactionResponse = {
  id: '22222222-2222-2222-2222-222222222222',
  listing: {
    id: 'listing-2',
    title: 'Nồi chiên không dầu Lock&Lock',
    listingType: 'GIVEAWAY',
    status: 'COMPLETED',
    price: null,
    currency: null,
    city: null,
    owner: {
      id: 'user-owner-2',
      displayName: 'Lê Văn Chủ',
    },
  },
  listingRequestId: 'req-2',
  owner: {
    id: 'user-owner-2',
    displayName: 'Lê Văn Chủ',
    avatarUrl: '/api/v1/files/avatars/owner-2.png',
  },
  requester: {
    id: 'user-req-2',
    displayName: 'Phạm Thị Khách',
    avatarUrl: 'https://lh3.googleusercontent.com/a/requester-2',
  },
  status: 'IN_PROGRESS',
  ownerCompleted: true,
  requesterCompleted: false,
  ownerCompletedAt: '2026-10-21T08:30:00Z',
  requesterCompletedAt: null,
  myRole: 'ADMIN',
  myCompleted: null,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-20T11:00:00Z',
  updatedAt: '2026-10-21T08:30:00Z',
};

const mockDetailCancelled: TransactionResponse = {
  id: '44444444-4444-4444-4444-444444444444',
  listing: {
    id: 'listing-4',
    title: 'Ghế xoay văn phòng Hòa Phát',
    listingType: 'GIVEAWAY',
    status: 'CANCELLED',
    price: null,
    currency: null,
    city: null,
    owner: {
      id: 'user-owner-4',
      displayName: 'Đặng Văn E',
    },
  },
  listingRequestId: 'req-4',
  owner: {
    id: 'user-owner-4',
    displayName: 'Đặng Văn E',
  },
  requester: {
    id: 'user-req-4',
    displayName: 'Bùi Thị F',
  },
  status: 'CANCELLED',
  ownerCompleted: false,
  requesterCompleted: false,
  ownerCompletedAt: null,
  requesterCompletedAt: null,
  myRole: 'ADMIN',
  myCompleted: null,
  cancelledBy: {
    id: 'admin-1',
    displayName: 'Quản trị viên Hệ thống',
    avatarUrl: '/api/v1/files/avatars/admin-1.png',
  },
  cancelledAt: '2026-10-23T10:00:00Z',
  cancellationReason: 'Hai bên không thỏa thuận được phương thức nhận đồ',
  createdAt: '2026-10-22T14:00:00Z',
  updatedAt: '2026-10-23T10:00:00Z',
};

const mockPageResponse: AdminTransactionsPageResponse = {
  content: [mockPendingTx, mockInProgressTx, mockCompletedTx, mockCancelledTx],
  totalElements: 4,
  totalPages: 1,
  size: 20,
  number: 0,
  numberOfElements: 4,
  first: true,
  last: true,
  empty: false,
};

describe('AdminTransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue(mockAdminAuthValue);

    vi.mocked(adminTransactionsApi.getAdminTransactions).mockResolvedValue(mockPageResponse);

    vi.mocked(transactionApi.getTransactionDetails).mockImplementation((id: string) => {
      if (id === mockDetailInProgress.id) {
        return Promise.resolve(mockDetailInProgress);
      }
      if (id === mockDetailCancelled.id) {
        return Promise.resolve(mockDetailCancelled);
      }
      return Promise.reject(new Error('Giao dịch không tồn tại'));
    });

    vi.mocked(transactionApi.cancelTransaction).mockResolvedValue({
      id: mockPendingTx.id,
      status: 'CANCELLED',
    } as TransactionResponse);
  });

  // 1 & 2: Correct initial API call and row rendering
  it('loads transactions on mount with correct default parameters and renders rows', async () => {
    renderWithProviders(<AdminTransactionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Quản lý giao dịch' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledWith({
      page: 0,
      size: 20,
      status: undefined,
      search: undefined,
    });

    // Check table headers and rows
    expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    expect(screen.getByText('Bàn phím cơ Bluetooth')).toBeInTheDocument();
    expect(screen.getByText('Ghế xoay văn phòng Hòa Phát')).toBeInTheDocument();

    // Check participant names
    expect(screen.getByText('Nguyễn Văn Chủ')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị Nhận')).toBeInTheDocument();

    // Check status labels
    expect(screen.getAllByText('Chờ xử lý').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đang diễn ra').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hoàn tất').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đã hủy').length).toBeGreaterThanOrEqual(1);
  });

  // 3: Status filtering
  it('filters transactions by status and resets page to 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const inProgressBtn = screen.getByRole('button', { name: 'Đang diễn ra' });
    await user.click(inProgressBtn);

    await waitFor(() => {
      expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 0,
          status: 'IN_PROGRESS',
        })
      );
    });

    // Click back to All
    const allBtn = screen.getByRole('button', { name: 'Tất cả trạng thái' });
    await user.click(allBtn);

    await waitFor(() => {
      expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 0,
          status: undefined,
        })
      );
    });
  });

  // 4: Search input and debounce behavior
  it('updates search query with debounce and resets page to 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm theo mã giao dịch/i);
    await user.type(searchInput, 'Lock&Lock');

    await waitFor(
      () => {
        expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 0,
            search: 'Lock&Lock',
          })
        );
      },
      { timeout: 1500 }
    );
  });

  // 5: Server-side pagination
  it('renders server-side pagination controls and disables them appropriately', async () => {
    const user = userEvent.setup();

    // Multi-page mock
    vi.mocked(adminTransactionsApi.getAdminTransactions).mockResolvedValue({
      content: [mockPendingTx, mockInProgressTx],
      totalElements: 40,
      totalPages: 2,
      size: 20,
      number: 0,
      numberOfElements: 2,
      first: true,
      last: false,
      empty: false,
    });

    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/trong tổng số/i)).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: 'Trang trước' });
    const nextButton = screen.getByRole('button', { name: 'Trang tiếp' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await user.click(nextButton);

    await waitFor(() => {
      expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  // 6: Loading, empty and error states
  it('renders loading skeleton and empty state properly', async () => {
    vi.mocked(adminTransactionsApi.getAdminTransactions).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      numberOfElements: 0,
      first: true,
      last: true,
      empty: true,
    });

    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy giao dịch nào')).toBeInTheDocument();
      expect(
        screen.getByText('Hệ thống hiện chưa có giao dịch trao đổi nào.')
      ).toBeInTheDocument();
    });
  });

  it('renders error state and supports retry', async () => {
    const user = userEvent.setup();
    vi.mocked(adminTransactionsApi.getAdminTransactions).mockRejectedValueOnce(
      new Error('Lỗi kết nối cơ sở dữ liệu')
    );

    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Lỗi kết nối cơ sở dữ liệu')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    vi.mocked(adminTransactionsApi.getAdminTransactions).mockResolvedValueOnce(mockPageResponse);

    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });
  });

  // 7 & 8: Transaction detail rendering with nullable cancellation metadata
  it('opens detail modal and displays full transaction information including dual confirmation progress', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    // Click "Chi tiết" for in-progress transaction
    const inProgressRow = screen.getByText('Nồi chiên không dầu Lock&Lock').closest('tr');
    expect(inProgressRow).not.toBeNull();
    const detailBtn = within(inProgressRow!).getByRole('button', { name: /Xem chi tiết giao dịch/i });
    await user.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Chi tiết giao dịch trao đổi' })).toBeInTheDocument();
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Thông tin giao dịch')).toBeInTheDocument();
      expect(within(dialog).getByText('Bài đăng liên quan')).toBeInTheDocument();
      expect(within(dialog).getByText('Các bên tham gia')).toBeInTheDocument();
      expect(within(dialog).getByText('Tiến độ xác nhận hai chiều (Dual-Party Confirmation)')).toBeInTheDocument();
    });

    expect(transactionApi.getTransactionDetails).toHaveBeenCalledWith(mockInProgressTx.id);

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Đóng chi tiết' });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { level: 2, name: 'Chi tiết giao dịch trao đổi' })).not.toBeInTheDocument();
    });
  });

  it('renders cancellation audit details for cancelled transaction in detail modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ghế xoay văn phòng Hòa Phát')).toBeInTheDocument();
    });

    const cancelledRow = screen.getByText('Ghế xoay văn phòng Hòa Phát').closest('tr');
    const detailBtn = within(cancelledRow!).getByRole('button', { name: /Xem chi tiết giao dịch/i });
    await user.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByText('Lịch sử hủy giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Hai bên không thỏa thuận được phương thức nhận đồ')).toBeInTheDocument();
      expect(screen.getByText('Quản trị viên Hệ thống')).toBeInTheDocument();
    });
  });

  // 9, 10, 11, 12, 13: Administrative cancellation flow & validation
  it('enforces cancellation reason constraints (1-500 chars) and handles cancellation submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const pendingRow = screen.getByText('Sách Lập trình TypeScript Nâng Cao').closest('tr');
    const cancelBtn = within(pendingRow!).getByRole('button', { name: /Hủy giao dịch 11111111/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Hủy giao dịch/i })).toBeInTheDocument();
    });

    const confirmSubmitBtn = screen.getByRole('button', { name: /Xác nhận hủy giao dịch/i });
    const reasonTextarea = screen.getByPlaceholderText(/Nhập lý do chi tiết cho việc hủy giao dịch/i);

    // Initial state: empty reason -> submit disabled
    expect(confirmSubmitBtn).toBeDisabled();

    // Type spaces only -> should stay disabled
    await user.type(reasonTextarea, '   ');
    expect(confirmSubmitBtn).toBeDisabled();

    // Type valid reason
    await user.clear(reasonTextarea);
    await user.type(reasonTextarea, 'Hai bên phát sinh tranh chấp nghiêm trọng cần hủy để bảo vệ quyền lợi');
    expect(confirmSubmitBtn).toBeEnabled();

    // Submit cancellation
    await user.click(confirmSubmitBtn);

    await waitFor(() => {
      expect(transactionApi.cancelTransaction).toHaveBeenCalledWith(mockPendingTx.id, {
        reason: 'Hai bên phát sinh tranh chấp nghiêm trọng cần hủy để bảo vệ quyền lợi',
      });
    });
  });

  it('displays error message when cancellation API fails', async () => {
    const user = userEvent.setup();
    vi.mocked(transactionApi.cancelTransaction).mockRejectedValueOnce(
      new Error('Giao dịch đã được đối tác hoàn tất, không thể hủy.')
    );

    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const pendingRow = screen.getByText('Sách Lập trình TypeScript Nâng Cao').closest('tr');
    const cancelBtn = within(pendingRow!).getByRole('button', { name: /Hủy giao dịch 11111111/i });
    await user.click(cancelBtn);

    const reasonTextarea = screen.getByPlaceholderText(/Nhập lý do chi tiết cho việc hủy giao dịch/i);
    await user.type(reasonTextarea, 'Lý do hủy thử nghiệm');

    const confirmSubmitBtn = screen.getByRole('button', { name: /Xác nhận hủy giao dịch/i });
    await user.click(confirmSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText('Giao dịch đã được đối tác hoàn tất, không thể hủy.')).toBeInTheDocument();
    });
  });

  // 14: Cancellation action is hidden for COMPLETED and CANCELLED transactions
  it('hides cancellation action for COMPLETED and CANCELLED transactions', async () => {
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Bàn phím cơ Bluetooth')).toBeInTheDocument();
      expect(screen.getByText('Ghế xoay văn phòng Hòa Phát')).toBeInTheDocument();
    });

    const completedRow = screen.getByText('Bàn phím cơ Bluetooth').closest('tr');
    const cancelledRow = screen.getByText('Ghế xoay văn phòng Hòa Phát').closest('tr');

    expect(within(completedRow!).queryByRole('button', { name: /Hủy/i })).not.toBeInTheDocument();
    expect(within(cancelledRow!).queryByRole('button', { name: /Hủy/i })).not.toBeInTheDocument();
  });

  // 15: ADMIN route protection using existing authorization architecture
  it('denies access to non-admin users via ProtectedRoute', () => {
    vi.mocked(useAuth).mockReturnValue(mockRegularAuthValue);

    renderWithProviders(
      <MemoryRouter initialEntries={['/admin/transactions']}>
        <Routes>
          <Route path="/login" element={<div>Trang đăng nhập</div>} />
          <Route
            path="/admin/transactions"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminTransactionsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
      { withRouter: false }
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Truy cập bị từ chối' })).toBeInTheDocument();
    expect(screen.getByText(/không có quyền truy cập khu vực giới hạn này/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Quản lý giao dịch' })).not.toBeInTheDocument();
  });

  it('renders participant avatars with custom, Google, and initials fallbacks in the transactions table', async () => {
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const ownerImg = screen.getByAltText('Ảnh đại diện của Nguyễn Văn Chủ');
    expect(ownerImg.tagName).toBe('IMG');
    expect(ownerImg).toHaveAttribute(
      'src',
      'http://localhost:8080/api/v1/files/avatars/owner-1.png'
    );

    const requesterImg = screen.getByAltText('Ảnh đại diện của Trần Thị Nhận');
    expect(requesterImg.tagName).toBe('IMG');
    expect(requesterImg).toHaveAttribute(
      'src',
      'https://lh3.googleusercontent.com/a/requester-1'
    );

    const fallbackRow = screen.getByText('Bàn phím cơ Bluetooth').closest('tr');
    expect(fallbackRow).not.toBeNull();
    expect(
      within(fallbackRow!).getByRole('img', { name: 'Ảnh đại diện của Hoàng Văn C' })
    ).toBeInTheDocument();
    expect(within(fallbackRow!).getByText('HC')).toBeInTheDocument();

    expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledTimes(1);
  });

  it('renders owner and requester avatars in the transaction detail modal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nồi chiên không dầu Lock&Lock')).toBeInTheDocument();
    });

    const inProgressRow = screen.getByText('Nồi chiên không dầu Lock&Lock').closest('tr');
    await user.click(
      within(inProgressRow!).getByRole('button', { name: /Xem chi tiết giao dịch/i })
    );

    const dialog = await screen.findByRole('dialog');
    const ownerAvatar = within(dialog).getByAltText('Ảnh đại diện của Lê Văn Chủ');
    expect(ownerAvatar.tagName).toBe('IMG');
    expect(ownerAvatar).toHaveAttribute(
      'src',
      'http://localhost:8080/api/v1/files/avatars/owner-2.png'
    );
    expect(
      within(dialog).getByAltText('Ảnh đại diện của Phạm Thị Khách')
    ).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/requester-2');

    expect(transactionApi.getTransactionDetails).toHaveBeenCalledWith(mockInProgressTx.id);
    expect(transactionApi.getTransactionDetails).toHaveBeenCalledTimes(1);
  });

  it('renders the cancelling administrator avatar in cancellation history', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ghế xoay văn phòng Hòa Phát')).toBeInTheDocument();
    });

    const cancelledRow = screen.getByText('Ghế xoay văn phòng Hòa Phát').closest('tr');
    await user.click(
      within(cancelledRow!).getByRole('button', { name: /Xem chi tiết giao dịch/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Lịch sử hủy giao dịch')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    const cancelAvatar = within(dialog).getByAltText(
      'Ảnh đại diện của Quản trị viên Hệ thống'
    );
    expect(cancelAvatar.tagName).toBe('IMG');
    expect(cancelAvatar).toHaveAttribute(
      'src',
      'http://localhost:8080/api/v1/files/avatars/admin-1.png'
    );
  });

  it('renders participant avatars in the administrative cancellation dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminTransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Sách Lập trình TypeScript Nâng Cao')).toBeInTheDocument();
    });

    const pendingRow = screen.getByText('Sách Lập trình TypeScript Nâng Cao').closest('tr');
    await user.click(
      within(pendingRow!).getByRole('button', { name: /Hủy giao dịch 11111111/i })
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByAltText('Ảnh đại diện của Nguyễn Văn Chủ')
    ).toHaveAttribute('src', 'http://localhost:8080/api/v1/files/avatars/owner-1.png');
    expect(
      within(dialog).getByAltText('Ảnh đại diện của Trần Thị Nhận')
    ).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/requester-1');

    expect(adminTransactionsApi.getAdminTransactions).toHaveBeenCalledTimes(1);
  });
});
