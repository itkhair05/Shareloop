import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordManagementCard } from '../components/PasswordManagementCard';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { SetPasswordModal } from '../components/SetPasswordModal';
import { authApi } from '@/features/auth/api/auth-api';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import type { UserProfile } from '@/types/auth';

// Mock authApi
vi.mock('@/features/auth/api/auth-api', () => ({
  authApi: {
    changePassword: vi.fn(),
    setPassword: vi.fn(),
    getCurrentUser: vi.fn(),
    getGoogleAccountStatus: vi.fn(),
  },
}));

// Mock useAuth refreshUser
const mockRefreshUser = vi.fn().mockResolvedValue(null);
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: mockUserRegularWithPassword,
    isAuthenticated: true,
    isLoading: false,
    refreshUser: mockRefreshUser,
  }),
}));

const mockUserRegularNoPassword: UserProfile = {
  id: 'user-no-pw-uuid',
  displayName: 'Nguyễn Văn Minh (Google)',
  email: 'minh.google@shareloop.org',
  phoneNumber: '0912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
  hasPassword: false,
};

const mockUserRegularWithPassword: UserProfile = {
  id: 'user-with-pw-uuid',
  displayName: 'Nguyễn Văn Minh (Password)',
  email: 'minh.password@shareloop.org',
  phoneNumber: '0912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
  hasPassword: true,
};

const mockAdminNoPassword: UserProfile = {
  id: 'admin-no-pw-uuid',
  displayName: 'Quản Trị Viên (Google)',
  email: 'admin.google@shareloop.org',
  phoneNumber: '0987654321',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
  hasPassword: false,
};

const mockAdminWithPassword: UserProfile = {
  id: 'admin-with-pw-uuid',
  displayName: 'Quản Trị Viên (Password)',
  email: 'admin.password@shareloop.org',
  phoneNumber: '0987654321',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
  hasPassword: true,
};

describe('Password Management Visibility & Business Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. USER with hasPassword=false: password section hidden
  it('1. hides the entire password-management section for USER with hasPassword=false', () => {
    renderWithProviders(<PasswordManagementCard user={mockUserRegularNoPassword} />);

    expect(screen.queryByTestId('password-management-card')).not.toBeInTheDocument();
    expect(screen.queryByText(/Đổi mật khẩu/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Thiết lập mật khẩu/i)).not.toBeInTheDocument();
  });

  // 2. USER with hasPassword=true: Change Password displayed
  it('2. displays Change Password for USER with hasPassword=true', () => {
    renderWithProviders(<PasswordManagementCard user={mockUserRegularWithPassword} />);

    expect(screen.getByTestId('password-management-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đổi mật khẩu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thiết lập mật khẩu/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Đã có mật khẩu/i)).toBeInTheDocument();
  });

  // 3. ADMIN with hasPassword=false: Set Password displayed
  it('3. displays Set Password for ADMIN with hasPassword=false', () => {
    renderWithProviders(<PasswordManagementCard user={mockAdminNoPassword} />);

    expect(screen.getByTestId('password-management-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thiết lập mật khẩu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đổi mật khẩu/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Chưa thiết lập mật khẩu/i)).toBeInTheDocument();
  });

  // 4. ADMIN with hasPassword=true: Change Password displayed
  it('4. displays Change Password for ADMIN with hasPassword=true', () => {
    renderWithProviders(<PasswordManagementCard user={mockAdminWithPassword} />);

    expect(screen.getByTestId('password-management-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đổi mật khẩu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Thiết lập mật khẩu/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Đã có mật khẩu/i)).toBeInTheDocument();
  });
});

describe('ChangePasswordModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 5. Successful password change
  it('5. submits valid password change, refreshes user, and calls onSuccess', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockResolvedValueOnce({
      message: 'Đổi mật khẩu thành công.',
    });

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại \*/i), 'OldPassword123!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'NewPassword123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'NewPassword123!');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(authApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith('Đổi mật khẩu thành công.');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // 6. Invalid current password error handling
  it('6. displays error message when backend returns invalid current password (400 Bad Request)', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockRejectedValueOnce(
      new ApiError({
        status: 400,
        error: 'Bad Request',
        message: 'Mật khẩu hiện tại không chính xác.',
      })
    );

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại \*/i), 'WrongCurrentPassword!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'NewPassword123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'NewPassword123!');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Mật khẩu hiện tại không chính xác/i);
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // 9. Client-side password validation
  it('9. enforces password validation rules client-side (min 8 chars, new != current, confirm match)', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Empty submission
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.getByText(/Mật khẩu hiện tại không được để trống/i)).toBeInTheDocument();
    expect(screen.getByText(/Mật khẩu mới không được để trống/i)).toBeInTheDocument();

    // New password too short (< 8 chars)
    await user.type(screen.getByLabelText(/Mật khẩu hiện tại \*/i), 'CurrentPass123!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'short');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'short');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText(/Mật khẩu phải từ 8 đến 100 ký tự/i)).toBeInTheDocument();

    // New password identical to current password
    await user.clear(screen.getByLabelText(/^Mật khẩu mới \*/i));
    await user.clear(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i));
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'CurrentPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'CurrentPass123!');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText(/Mật khẩu mới không được trùng với mật khẩu hiện tại/i)).toBeInTheDocument();

    // Confirm password mismatch
    await user.clear(screen.getByLabelText(/^Mật khẩu mới \*/i));
    await user.clear(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i));
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'BrandNewPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'MismatchedPass123!');
    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    expect(screen.getByText(/Mật khẩu xác nhận không khớp với mật khẩu mới/i)).toBeInTheDocument();
    expect(authApi.changePassword).not.toHaveBeenCalled();
  });

  // 10. Rate limit (429) handling on change-password
  it('10. handles HTTP 429 rate limit exceeded error for change password', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.changePassword).mockRejectedValueOnce(
      new ApiError({
        status: 429,
        error: 'Too Many Requests',
        message: 'Quá nhiều yêu cầu đổi mật khẩu. Vui lòng thử lại sau 1 phút.',
      })
    );

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại \*/i), 'CurrentPass123!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'NewPass123!');

    await user.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Quá nhiều yêu cầu đổi mật khẩu. Vui lòng thử lại sau 1 phút/i);
    });
  });

  // 11. Loading and duplicate-submission prevention on change-password
  it('11. prevents duplicate submissions while change password request is pending', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: { message: string }) => void = () => {};
    const pendingPromise = new Promise<{ message: string }>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(authApi.changePassword).mockReturnValueOnce(pendingPromise);

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Mật khẩu hiện tại \*/i), 'CurrentPass123!');
    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'NewPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'NewPass123!');

    const submitBtn = screen.getByRole('button', { name: 'Đổi mật khẩu' });
    await user.click(submitBtn);

    // Button should be disabled during submission
    expect(submitBtn).toBeDisabled();

    // Resolve
    await act(async () => {
      resolvePromise!({ message: 'Đổi mật khẩu thành công.' });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('Đổi mật khẩu thành công.');
    });
  });

  // Show/Hide password toggle controls
  it('toggles password visibility when clicking eye icons', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <ChangePasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const currentInput = screen.getByLabelText(/Mật khẩu hiện tại \*/i);
    expect(currentInput).toHaveAttribute('type', 'password');

    const toggleCurrentBtn = screen.getByLabelText(/Hiện mật khẩu hiện tại/i);
    await user.click(toggleCurrentBtn);
    expect(currentInput).toHaveAttribute('type', 'text');

    const hideCurrentBtn = screen.getByLabelText(/Ẩn mật khẩu hiện tại/i);
    await user.click(hideCurrentBtn);
    expect(currentInput).toHaveAttribute('type', 'password');
  });
});

describe('SetPasswordModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 7. Successful password setup
  it('7. submits valid initial password, refreshes user cache, and calls onSuccess', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setPassword).mockResolvedValueOnce({
      message: 'Thiết lập mật khẩu thành công.',
    });

    renderWithProviders(
      <SetPasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'InitialPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'InitialPass123!');

    await user.click(screen.getByRole('button', { name: 'Thiết lập mật khẩu' }));

    await waitFor(() => {
      expect(authApi.setPassword).toHaveBeenCalledWith({
        newPassword: 'InitialPass123!',
      });
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith('Thiết lập mật khẩu thành công.');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // 8. Password already exists conflict handling
  it('8. handles 409 Conflict when account already has a password', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setPassword).mockRejectedValueOnce(
      new ApiError({
        status: 409,
        error: 'Conflict',
        message: 'Tài khoản đã có mật khẩu. Vui lòng sử dụng chức năng đổi mật khẩu.',
      })
    );

    renderWithProviders(
      <SetPasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'InitialPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'InitialPass123!');

    await user.click(screen.getByRole('button', { name: 'Thiết lập mật khẩu' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Tài khoản đã có mật khẩu. Vui lòng sử dụng chức năng đổi mật khẩu/i);
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  // 10b. Rate limit (429) handling on set-password
  it('10b. handles HTTP 429 rate limit exceeded error for set password', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.setPassword).mockRejectedValueOnce(
      new ApiError({
        status: 429,
        error: 'Too Many Requests',
        message: 'Quá nhiều yêu cầu thiết lập mật khẩu. Vui lòng thử lại sau 1 phút.',
      })
    );

    renderWithProviders(
      <SetPasswordModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await user.type(screen.getByLabelText(/^Mật khẩu mới \*/i), 'InitialPass123!');
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu mới \*/i), 'InitialPass123!');

    await user.click(screen.getByRole('button', { name: 'Thiết lập mật khẩu' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Quá nhiều yêu cầu thiết lập mật khẩu. Vui lòng thử lại sau 1 phút/i);
    });
  });
});
