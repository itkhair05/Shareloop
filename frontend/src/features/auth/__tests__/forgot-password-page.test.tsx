import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { authApi } from '../api/auth-api';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('../api/auth-api', () => ({
  authApi: {
    forgotPassword: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders forgot password form elements with accessible labels and links', () => {
    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    expect(screen.getByRole('heading', { name: /quên mật khẩu\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/địa chỉ email tài khoản/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /đăng nhập ngay/i })).toHaveAttribute('href', '/login');
  });

  it('validates empty email and invalid email format before API submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    const submitBtn = screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/vui lòng nhập địa chỉ email/i)).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();

    const emailInput = screen.getByLabelText(/địa chỉ email tài khoản/i);
    await user.type(emailInput, 'invalid-email-format');
    await user.click(submitBtn);

    expect(await screen.findByText(/vui lòng nhập địa chỉ email hợp lệ/i)).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
  });

  it('submits valid email, displays generic success confirmation and security notes', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.forgotPassword).mockResolvedValueOnce({
      message: 'If the email is registered, a password reset link has been sent.',
    });

    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    const emailInput = screen.getByLabelText(/địa chỉ email tài khoản/i);
    await user.type(emailInput, 'student@university.edu.vn');

    const submitBtn = screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i });
    await user.click(submitBtn);

    expect(authApi.forgotPassword).toHaveBeenCalledWith({
      email: 'student@university.edu.vn',
    });

    expect(await screen.findByText(/đã gửi hướng dẫn đặt lại mật khẩu!/i)).toBeInTheDocument();
    expect(screen.getByText(/15 phút/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quay lại trang đăng nhập/i })).toHaveAttribute('href', '/login');
  });

  it('displays rate-limit message when receiving HTTP 429 Too Many Requests', async () => {
    const user = userEvent.setup();
    const rateLimitError = new ApiError({
      message: 'Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.',
      status: 429,
      error: 'Too Many Requests',
    });

    vi.mocked(authApi.forgotPassword).mockRejectedValueOnce(rateLimitError);

    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    const emailInput = screen.getByLabelText(/địa chỉ email tài khoản/i);
    await user.type(emailInput, 'student@university.edu.vn');

    const submitBtn = screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần/i)).toBeInTheDocument();
  });

  it('displays friendly network error message when server is unreachable', async () => {
    const user = userEvent.setup();
    const networkError = new ApiError({
      message: 'Network Error',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });

    vi.mocked(authApi.forgotPassword).mockRejectedValueOnce(networkError);

    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    const emailInput = screen.getByLabelText(/địa chỉ email tài khoản/i);
    await user.type(emailInput, 'student@university.edu.vn');

    const submitBtn = screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/không thể kết nối đến máy chủ/i)).toBeInTheDocument();
  });

  it('prevents duplicate submissions while request is in flight', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: { message: string }) => void = () => {};
    const pendingPromise = new Promise<{ message: string }>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(authApi.forgotPassword).mockReturnValueOnce(pendingPromise);

    renderWithProviders(<ForgotPasswordPage />, { initialEntries: ['/forgot-password'] });

    const emailInput = screen.getByLabelText(/địa chỉ email tài khoản/i);
    await user.type(emailInput, 'student@university.edu.vn');

    const submitBtn = screen.getByRole('button', { name: /gửi liên kết đặt lại mật khẩu/i });
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(emailInput).toBeDisabled();
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(1);

    // Resolve request
    resolvePromise({ message: 'Success' });
    await waitFor(() => {
      expect(screen.getByText(/đã gửi hướng dẫn đặt lại mật khẩu!/i)).toBeInTheDocument();
    });
  });
});
