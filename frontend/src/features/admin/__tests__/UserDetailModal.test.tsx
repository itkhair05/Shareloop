import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserDetailModal } from '../components/UserDetailModal';
import { adminUsersApi } from '../api/admin-users-api';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { AdminUserResponse } from '@/types/admin-user';

vi.mock('../api/admin-users-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-users-api')>();
  return {
    ...actual,
    adminUsersApi: {
      ...actual.adminUsersApi,
      getAdminUserById: vi.fn(),
    },
  };
});

const mockUser: AdminUserResponse = {
  id: 'user-uuid-1234',
  displayName: 'Lê Hoàng Nam',
  email: 'nam.le@example.com',
  phoneNumber: '0912999888',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-15T15:30:00Z',
};

describe('UserDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(<UserDetailModal isOpen={false} onClose={vi.fn()} userId="user-uuid-1234" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders loading state when fetching user details', () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockReturnValue(new Promise(() => {}));

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /đang tải chi tiết người dùng/i })).toBeInTheDocument();
  });

  it('renders error state with retry button when query fails', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockRejectedValue(
      new ApiError({
        message: 'Không tìm thấy người dùng trong hệ thống',
        status: 404,
        error: 'Not Found',
      })
    );

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải thông tin người dùng')).toBeInTheDocument();
      expect(screen.getByText('Không tìm thấy người dùng trong hệ thống')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('displays full user details without exposing passwords or auth secrets', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue(mockUser);

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    await waitFor(() => {
      expect(screen.getByText('Lê Hoàng Nam')).toBeInTheDocument();
    });

    expect(screen.getByText('Chi tiết tài khoản người dùng')).toBeInTheDocument();
    expect(screen.getAllByText('nam.le@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('user-uuid-1234')).toBeInTheDocument();
    expect(screen.getByText('0912999888')).toBeInTheDocument();
    expect(screen.getByText('Quản trị viên (ADMIN)')).toBeInTheDocument();
    expect(screen.getByText('Đang hoạt động (ACTIVE)')).toBeInTheDocument();
  });

  it('displays "Chưa cập nhật" when phone number is missing', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue({
      ...mockUser,
      phoneNumber: null,
    });

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    await waitFor(() => {
      expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue(mockUser);

    renderWithProviders(<UserDetailModal isOpen={true} onClose={handleClose} userId="user-uuid-1234" />);

    await waitFor(() => {
      expect(screen.getByText('Lê Hoàng Nam')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /^đóng$/i });
    await user.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue(mockUser);

    renderWithProviders(<UserDetailModal isOpen={true} onClose={handleClose} userId="user-uuid-1234" />);

    await waitFor(() => {
      expect(screen.getByText('Lê Hoàng Nam')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom avatar image in the user identity banner', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue({
      ...mockUser,
      avatarUrl: '/api/v1/files/avatars/nam.png',
    });

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    const avatarImg = await screen.findByAltText('Ảnh đại diện của Lê Hoàng Nam');
    expect(avatarImg.tagName).toBe('IMG');
    expect(avatarImg).toHaveAttribute(
      'src',
      'http://localhost:8080/api/v1/files/avatars/nam.png'
    );
    expect(adminUsersApi.getAdminUserById).toHaveBeenCalledTimes(1);
  });

  it('renders Google avatar image in the user identity banner', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue({
      ...mockUser,
      avatarUrl: 'https://lh3.googleusercontent.com/a/nam-google',
    });

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    const avatarImg = await screen.findByAltText('Ảnh đại diện của Lê Hoàng Nam');
    expect(avatarImg).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/nam-google');
  });

  it('renders initials fallback when the user has no avatar', async () => {
    vi.mocked(adminUsersApi.getAdminUserById).mockResolvedValue({
      ...mockUser,
      avatarUrl: null,
    });

    renderWithProviders(<UserDetailModal isOpen={true} onClose={vi.fn()} userId="user-uuid-1234" />);

    const fallback = await screen.findByRole('img', {
      name: 'Ảnh đại diện của Lê Hoàng Nam',
    });
    expect(fallback.tagName).toBe('DIV');
    expect(screen.getByText('LN')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
