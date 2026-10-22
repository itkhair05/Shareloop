import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterPage } from '../pages/RegisterPage';
import { authApi } from '../api/auth-api';
import { tokenStorage } from '@/lib/token-storage';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import type { AuthResponse, UserProfile } from '@/types/auth';

vi.mock('../api/auth-api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.clearAccessToken();
  });

  it('renders registration form with all required inputs and login link', () => {
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    expect(screen.getByRole('heading', { name: /tạo tài khoản mới/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/họ và tên hoặc tên hiển thị/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mật khẩu \(tối thiểu 8 ký tự\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^xác nhận mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tạo tài khoản/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /đăng nhập ngay/i })).toHaveAttribute('href', '/login');
  });

  it('validates required fields on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }));

    expect(await screen.findByText(/vui lòng nhập tên hiển thị/i)).toBeInTheDocument();
    expect(await screen.findByText(/vui lòng nhập địa chỉ email/i)).toBeInTheDocument();
    expect(await screen.findByText(/vui lòng nhập mật khẩu/i)).toBeInTheDocument();
    expect(await screen.findByText(/vui lòng xác nhận mật khẩu/i)).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('validates password length and password confirmation mismatch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.type(screen.getByLabelText(/họ và tên hoặc tên hiển thị/i), 'Bob Builder');
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'bob@shareloop.org');
    await user.type(screen.getByLabelText(/mật khẩu \(tối thiểu 8 ký tự\)/i), 'short'); // < 8 chars
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'different');

    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }));

    expect(await screen.findByText(/mật khẩu phải có ít nhất 8 ký tự/i)).toBeInTheDocument();
    expect(await screen.findByText(/mật khẩu xác nhận không khớp/i)).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('successfully registers user, persists token, and navigates', async () => {
    const user = userEvent.setup();
    const mockAuthResponse: AuthResponse = {
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Bob Builder',
      email: 'bob@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      accessToken: 'registered-jwt-token-abc',
      tokenType: 'Bearer',
    };

    const mockProfile: UserProfile = {
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Bob Builder',
      email: 'bob@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.register).mockResolvedValueOnce(mockAuthResponse);
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.type(screen.getByLabelText(/họ và tên hoặc tên hiển thị/i), 'Bob Builder');
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'bob@shareloop.org');
    await user.type(screen.getByLabelText(/mật khẩu \(tối thiểu 8 ký tự\)/i), 'strongPass123');
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'strongPass123');

    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        displayName: 'Bob Builder',
        email: 'bob@shareloop.org',
        password: 'strongPass123',
      });
      expect(tokenStorage.getAccessToken()).toBe('registered-jwt-token-abc');
    });
  });

  it('handles duplicate email (409 Conflict) and sets field error', async () => {
    const user = userEvent.setup();
    const duplicateError = new ApiError({
      message: 'Email is already taken',
      status: 409,
      error: 'Conflict',
    });

    vi.mocked(authApi.register).mockRejectedValueOnce(duplicateError);

    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.type(screen.getByLabelText(/họ và tên hoặc tên hiển thị/i), 'Jane Duplicate');
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'duplicate@shareloop.org');
    await user.type(screen.getByLabelText(/mật khẩu \(tối thiểu 8 ký tự\)/i), 'securePassword123');
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'securePassword123');

    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }));

    expect(await screen.findByText(/địa chỉ email này đã được sử dụng/i)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/email này đã được đăng ký/i);
    expect(tokenStorage.hasToken()).toBe(false);
  });
});
