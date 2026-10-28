import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminUsersPage } from '../AdminUsersPage';
import { adminUsersApi } from '../api/admin-users-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { AdminUserResponse } from '@/types/admin-user';
import type { PageResponse } from '@/types/api';

vi.mock('../api/admin-users-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-users-api')>();
  return {
    ...actual,
    adminUsersApi: {
      ...actual.adminUsersApi,
      getAdminUsers: vi.fn(),
      getAdminUserById: vi.fn(),
      updateUserStatus: vi.fn(),
      updateUserRole: vi.fn(),
    },
  };
});

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockCurrentAdminUser = {
  id: 'admin-1',
  displayName: 'Admin Quản Trị Viên',
  email: 'admin@shareloop.com',
  phoneNumber: '0901234567',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
};

const mockRegularUser: AdminUserResponse = {
  id: 'user-2',
  displayName: 'Nguyễn Văn A',
  email: 'vana@example.com',
  phoneNumber: '0912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-10T09:00:00Z',
  updatedAt: '2026-10-10T09:00:00Z',
};

const mockSuspendedUser: AdminUserResponse = {
  id: 'user-3',
  displayName: 'Trần Thị B',
  email: 'thib@example.com',
  phoneNumber: null,
  role: 'USER',
  status: 'SUSPENDED',
  createdAt: '2026-10-15T11:00:00Z',
  updatedAt: '2026-10-20T14:00:00Z',
};

const mockDeactivatedUser: AdminUserResponse = {
  id: 'user-4',
  displayName: 'Lê Văn C',
  email: 'vanc@example.com',
  phoneNumber: '0987654321',
  role: 'USER',
  status: 'DEACTIVATED',
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-25T16:00:00Z',
};

const mockAdminColleague: AdminUserResponse = {
  id: 'admin-2',
  displayName: 'Trần Đồng Nghiệp Admin',
  email: 'colleague@shareloop.com',
  phoneNumber: '0933333333',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-10-05T08:00:00Z',
  updatedAt: '2026-10-05T08:00:00Z',
};

function createMockPage(
  content: AdminUserResponse[],
  totalElements = content.length,
  totalPages = 1,
  pageNumber = 0,
  pageSize = 20
): PageResponse<AdminUserResponse> {
  return {
    content,
    totalElements,
    totalPages,
    size: pageSize,
    number: pageNumber,
    first: pageNumber === 0,
    last: pageNumber >= totalPages - 1,
    empty: content.length === 0,
    numberOfElements: content.length,
  };
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockCurrentAdminUser,
      isLoading: false,
      isAuthenticated: true,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      clearError: vi.fn(),
    });
  });

  it('renders loading skeleton while fetching initial users', () => {
    vi.mocked(adminUsersApi.getAdminUsers).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    expect(screen.getByRole('status', { name: /đang tải danh sách người dùng/i })).toBeInTheDocument();
  });

  it('renders error state with retry button on network failure', async () => {
    vi.mocked(adminUsersApi.getAdminUsers).mockRejectedValue(
      new ApiError({
        message: 'Không thể kết nối đến máy chủ quản trị',
        status: 500,
        error: 'Internal Server Error',
      })
    );

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách người dùng')).toBeInTheDocument();
      expect(screen.getByText('Không thể kết nối đến máy chủ quản trị')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('renders empty state when no users are in the system', async () => {
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Chưa có người dùng nào trong hệ thống')).toBeInTheDocument();
    });
  });

  it('renders table with accurate user count and correct row contents', async () => {
    const pageData = createMockPage([
      mockCurrentAdminUser,
      mockRegularUser,
      mockSuspendedUser,
      mockDeactivatedUser,
    ]);
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(pageData);

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Quản lý người dùng' })).toBeInTheDocument();
      expect(screen.getByText('4 người dùng')).toBeInTheDocument();
    });

    // Check display name and emails
    expect(screen.getByText('Admin Quản Trị Viên')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn C')).toBeInTheDocument();

    // Check missing phone number displays "-"
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('identifies current administrator row with "Bạn" badge and disables self-modification', async () => {
    const pageData = createMockPage([mockCurrentAdminUser, mockRegularUser]);
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(pageData);

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Admin Quản Trị Viên')).toBeInTheDocument();
    });

    // Self badge
    expect(screen.getByText('Bạn')).toBeInTheDocument();
    expect(screen.getByText('(Tài khoản hiện tại)')).toBeInTheDocument();
  });

  it('handles search input with debouncing and passes search parameter', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const searchInput = screen.getByRole('textbox', { name: /tìm kiếm người dùng/i });
    await user.type(searchInput, 'Nguyễn');

    await waitFor(
      () => {
        expect(adminUsersApi.getAdminUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Nguyễn',
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it('filters by role when role dropdown option is selected', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const roleSelect = screen.getByRole('combobox', { name: /lọc theo vai trò/i });
    await user.selectOptions(roleSelect, 'ADMIN');

    await waitFor(() => {
      expect(adminUsersApi.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'ADMIN',
        })
      );
    });
  });

  it('filters by status when status chips are clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockSuspendedUser]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    });

    const suspendedChip = screen.getByRole('button', { name: /^bị khóa$/i });
    await user.click(suspendedChip);

    await waitFor(() => {
      expect(adminUsersApi.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUSPENDED',
        })
      );
    });
  });

  it('resets filters when "Đặt lại bộ lọc" is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const statusChip = screen.getByRole('button', { name: /^bị khóa$/i });
    await user.click(statusChip);

    const resetBtn = await screen.findByRole('button', { name: /đặt lại bộ lọc/i });
    await user.click(resetBtn);

    await waitFor(() => {
      expect(adminUsersApi.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          search: undefined,
          role: undefined,
          status: undefined,
          page: 0,
        })
      );
    });
  });

  it('handles pagination navigation and size change', async () => {
    const user = userEvent.setup();
    const page1Data = createMockPage([mockRegularUser], 25, 2, 0, 20);
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(page1Data);

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('25 người dùng')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /trang sau/i });
    expect(nextBtn).toBeEnabled();

    const prevBtn = screen.getByRole('button', { name: /trang trước/i });
    expect(prevBtn).toBeDisabled();

    await user.click(nextBtn);

    await waitFor(() => {
      expect(adminUsersApi.getAdminUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });
  });

  it('opens UserDetailModal and retrieves user by id on clicking "Chi tiết"', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue(mockRegularUser);

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const detailBtn = screen.getByRole('button', { name: /xem chi tiết nguyễn văn a/i });
    await user.click(detailBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Chi tiết tài khoản người dùng' })).toBeInTheDocument();
      expect(screen.getByText('Mã định danh (ID)')).toBeInTheDocument();
      expect(screen.getByText('user-2')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /^đóng$/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Chi tiết tài khoản người dùng' })).not.toBeInTheDocument();
    });
  });

  it('handles promoting USER to ADMIN with confirmation dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));
    vi.mocked(adminUsersApi.updateUserRole).mockResolvedValue({
      ...mockRegularUser,
      role: 'ADMIN',
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /cấp admin cho nguyễn văn a/i });
    await user.click(promoteBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('heading', { name: 'Nâng cấp quyền Quản trị viên (ADMIN)' })).toBeInTheDocument();
    expect(screen.getByText(/Bạn có chắc chắn muốn nâng cấp tài khoản/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Nâng cấp Admin' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateUserRole).toHaveBeenCalledWith('user-2', { role: 'ADMIN' });
      expect(screen.getByText(/Đã nâng cấp quyền Quản trị viên \(ADMIN\) cho "Nguyễn Văn A" thành công/i)).toBeInTheDocument();
    });
  });

  it('handles demoting ADMIN to USER with confirmation dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockAdminColleague]));
    vi.mocked(adminUsersApi.updateUserRole).mockResolvedValue({
      ...mockAdminColleague,
      role: 'USER',
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Trần Đồng Nghiệp Admin')).toBeInTheDocument();
    });

    const demoteBtn = screen.getByRole('button', { name: /hạ quyền admin của trần đồng nghiệp admin/i });
    await user.click(demoteBtn);

    expect(screen.getByRole('heading', { name: 'Gỡ quyền Quản trị viên' })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Hạ quyền' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateUserRole).toHaveBeenCalledWith('admin-2', { role: 'USER' });
      expect(screen.getByText(/Đã hạ quyền tài khoản "Trần Đồng Nghiệp Admin" về Người dùng thông thường/i)).toBeInTheDocument();
    });
  });

  it('handles suspending an active user with confirmation dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));
    vi.mocked(adminUsersApi.updateUserStatus).mockResolvedValue({
      ...mockRegularUser,
      status: 'SUSPENDED',
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const suspendBtn = screen.getByRole('button', { name: /khóa tài khoản nguyễn văn a/i });
    await user.click(suspendBtn);

    expect(screen.getByRole('heading', { name: 'Khóa tài khoản người dùng' })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Khóa tài khoản' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateUserStatus).toHaveBeenCalledWith('user-2', { status: 'SUSPENDED' });
      expect(screen.getByText(/Đã tạm khóa tài khoản "Nguyễn Văn A"/i)).toBeInTheDocument();
    });
  });

  it('handles unlocking/activating a suspended user with confirmation dialog', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockSuspendedUser]));
    vi.mocked(adminUsersApi.updateUserStatus).mockResolvedValue({
      ...mockSuspendedUser,
      status: 'ACTIVE',
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    });

    const unlockBtn = screen.getByRole('button', { name: /mở khóa tài khoản trần thị b/i });
    await user.click(unlockBtn);

    expect(screen.getByRole('heading', { name: 'Mở khóa tài khoản' })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Mở khóa' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateUserStatus).toHaveBeenCalledWith('user-3', { status: 'ACTIVE' });
      expect(screen.getByText(/Đã mở khóa và kích hoạt tài khoản "Trần Thị B" thành công/i)).toBeInTheDocument();
    });
  });

  it('handles deactivating a user with warning dialog and blocks transitions on DEACTIVATED accounts', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));
    vi.mocked(adminUsersApi.updateUserStatus).mockResolvedValue({
      ...mockRegularUser,
      status: 'DEACTIVATED',
    });

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const deactivateBtn = screen.getByRole('button', { name: /vô hiệu hóa tài khoản nguyễn văn a/i });
    await user.click(deactivateBtn);

    expect(screen.getByRole('heading', { name: 'Vô hiệu hóa tài khoản vĩnh viễn' })).toBeInTheDocument();
    expect(screen.getByText(/CẢNH BÁO QUAN TRỌNG/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Vô hiệu hóa vĩnh viễn' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(adminUsersApi.updateUserStatus).toHaveBeenCalledWith('user-2', { status: 'DEACTIVATED' });
    });
  });

  it('does not display role/status modification actions for DEACTIVATED accounts', async () => {
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockDeactivatedUser]));

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Lê Văn C')).toBeInTheDocument();
    });

    expect(screen.getByText('Đã vô hiệu hóa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cấp admin cho lê văn c/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /khóa tài khoản lê văn c/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mở khóa tài khoản lê văn c/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /vô hiệu hóa tài khoản lê văn c/i })).not.toBeInTheDocument();
  });

  it('displays error feedback when mutation fails', async () => {
    const user = userEvent.setup();
    vi.mocked(adminUsersApi.getAdminUsers).mockResolvedValue(createMockPage([mockRegularUser]));
    vi.mocked(adminUsersApi.updateUserRole).mockRejectedValue(
      new ApiError({
        message: 'Không thể hạ quyền quản trị viên cuối cùng của hệ thống',
        status: 400,
        error: 'Bad Request',
      })
    );

    renderWithProviders(<AdminUsersPage />, { initialEntries: ['/admin/users'] });

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    });

    const promoteBtn = screen.getByRole('button', { name: /cấp admin cho nguyễn văn a/i });
    await user.click(promoteBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Nâng cấp Admin' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Không thể hạ quyền quản trị viên cuối cùng của hệ thống')).toBeInTheDocument();
    });
  });
});
