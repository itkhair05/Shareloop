import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../pages/LoginPage';
import { resolvePostLoginDestination } from '../utils/auth-redirect';
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStorage.clearAccessToken();
  });

  it('renders login form elements with accessible labels and show/hide password toggle', () => {
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    expect(screen.getByRole('heading', { name: /chào mừng trở lại/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng nhập/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hiện mật khẩu/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /đăng ký tài khoản mới/i })).toHaveAttribute('href', '/register');
  });

  it('toggles password visibility when clicking toggle button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    const passwordInput = screen.getByLabelText(/^mật khẩu$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /hiện mật khẩu/i });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /ẩn mật khẩu/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ẩn mật khẩu/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required fields and email format on client submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    const submitBtn = screen.getByRole('button', { name: /đăng nhập/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/vui lòng nhập địa chỉ email/i)).toBeInTheDocument();
    expect(await screen.findByText(/vui lòng nhập mật khẩu/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();

    // Invalid email format
    const emailInput = screen.getByLabelText(/địa chỉ email/i);
    await user.type(emailInput, 'invalid-email');
    await user.click(submitBtn);

    expect(await screen.findByText(/vui lòng nhập địa chỉ email hợp lệ/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('performs successful login, stores token, and navigates', async () => {
    const user = userEvent.setup();
    const mockAuthResponse: AuthResponse = {
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Alice Community',
      email: 'alice@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      accessToken: 'mock-jwt-token-xyz',
      tokenType: 'Bearer',
    };

    const mockProfile: UserProfile = {
      id: '11111111-1111-1111-1111-111111111111',
      displayName: 'Alice Community',
      email: 'alice@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse);
    vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockProfile);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'alice@shareloop.org');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'password123');

    const submitBtn = screen.getByRole('button', { name: /đăng nhập/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: 'alice@shareloop.org',
        password: 'password123',
      });
      expect(tokenStorage.getAccessToken()).toBe('mock-jwt-token-xyz');
    });
  });

  it('displays user-friendly error message on 401 Unauthorized invalid credentials', async () => {
    const user = userEvent.setup();
    const unauthorizedError = new ApiError({
      message: 'Email hoặc mật khẩu không chính xác',
      status: 401,
      error: 'Unauthorized',
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(unauthorizedError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'wrong@shareloop.org');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/email hoặc mật khẩu không chính xác/i);
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('displays error message when account is suspended or deactivated (403 Forbidden)', async () => {
    const user = userEvent.setup();
    const forbiddenError = new ApiError({
      message: 'Tài khoản của bạn đã bị tạm khóa',
      status: 403,
      error: 'Forbidden',
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(forbiddenError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'suspended@shareloop.org');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/tài khoản của bạn đã bị tạm khóa/i);
  });

  it('displays clear message on network error without crashing', async () => {
    const user = userEvent.setup();
    const networkError = new ApiError({
      message: 'Không thể kết nối đến máy chủ',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(networkError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/địa chỉ email/i), 'alice@shareloop.org');
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/không thể kết nối đến máy chủ/i);
  });

  describe('Post-login Redirection Logic (resolvePostLoginDestination)', () => {
    it('redirects an ADMIN logging in directly without previous destination to /admin', () => {
      expect(resolvePostLoginDestination(undefined, 'ADMIN')).toBe('/admin');
      expect(resolvePostLoginDestination({}, 'ADMIN')).toBe('/admin');
    });

    it('redirects an ADMIN with prior from destination to that specific destination', () => {
      expect(resolvePostLoginDestination({ pathname: '/admin/categories' }, 'ADMIN')).toBe('/admin/categories');
      expect(resolvePostLoginDestination({ pathname: '/listings/new', search: '?type=GIVEAWAY' }, 'ADMIN')).toBe('/listings/new?type=GIVEAWAY');
    });

    it('redirects a regular USER logging in directly to /', () => {
      expect(resolvePostLoginDestination(undefined, 'USER')).toBe('/');
      expect(resolvePostLoginDestination({}, 'USER')).toBe('/');
    });

    it('redirects a regular USER with prior from destination to that specific destination', () => {
      expect(resolvePostLoginDestination({ pathname: '/listings/new' }, 'USER')).toBe('/listings/new');
      expect(resolvePostLoginDestination({ pathname: '/profile' }, 'USER')).toBe('/profile');
    });

    it('sanitizes unsafe or circular redirect destinations', () => {
      // Directs away from circular /login redirect
      expect(resolvePostLoginDestination({ pathname: '/login' }, 'ADMIN')).toBe('/admin');
      expect(resolvePostLoginDestination({ pathname: '/login' }, 'USER')).toBe('/');
      // Rejects non-relative paths
      expect(resolvePostLoginDestination({ pathname: 'http://malicious.site' }, 'USER')).toBe('/');
    });
  });
});
