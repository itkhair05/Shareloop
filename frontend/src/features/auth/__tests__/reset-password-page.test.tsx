import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { authApi } from '../api/auth-api';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';

vi.mock('../api/auth-api', () => ({
  authApi: {
    resetPassword: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

describe('ResetPasswordPage', () => {
  const validToken = 'valid-test-reset-token-1234567890';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays missing-token warning and recovery link when navigated without token', () => {
    renderWithProviders(<ResetPasswordPage />, { initialEntries: ['/reset-password'] });

    expect(screen.getByRole('heading', { name: /tạo mật khẩu mới/i })).toBeInTheDocument();
    expect(screen.getByText(/thiếu mã xác thực đặt lại mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /yêu cầu liên kết đặt lại mật khẩu mới/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
    expect(screen.queryByLabelText(/mật khẩu mới/i)).not.toBeInTheDocument();
  });

  it('strips token from visible browser URL while retaining it in memory for submission', () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    // Address bar should be sanitized
    expect(replaceStateSpy).toHaveBeenCalled();
    // Form elements should be rendered because token was captured into memory
    expect(screen.getByLabelText(/^mật khẩu mới$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/xác nhận mật khẩu mới/i)).toBeInTheDocument();

    replaceStateSpy.mockRestore();
  });

  it('validates password minimum length (8 chars) and password mismatch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    const submitBtn = screen.getByRole('button', { name: /lưu mật khẩu mới/i });
    const passwordInput = screen.getByLabelText(/^mật khẩu mới$/i);
    const confirmInput = screen.getByLabelText(/xác nhận mật khẩu mới/i);

    // Short password (< 8 chars)
    await user.type(passwordInput, 'short');
    await user.type(confirmInput, 'short');
    await user.click(submitBtn);

    expect(await screen.findByText(/mật khẩu phải có ít nhất 8 ký tự/i)).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();

    // Mismatched confirmation password
    await user.clear(passwordInput);
    await user.clear(confirmInput);
    await user.type(passwordInput, 'SecurePassword123!');
    await user.type(confirmInput, 'DifferentPassword456!');
    await user.click(submitBtn);

    expect(await screen.findByText(/mật khẩu xác nhận không khớp/i)).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('submits token and new password, never sends confirmPassword, and shows success state', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.resetPassword).mockResolvedValueOnce({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    const passwordInput = screen.getByLabelText(/^mật khẩu mới$/i);
    const confirmInput = screen.getByLabelText(/xác nhận mật khẩu mới/i);
    const submitBtn = screen.getByRole('button', { name: /lưu mật khẩu mới/i });

    await user.type(passwordInput, 'NewSecurePassword2026!');
    await user.type(confirmInput, 'NewSecurePassword2026!');
    await user.click(submitBtn);

    // Verify payload: only token and newPassword are sent
    expect(authApi.resetPassword).toHaveBeenCalledWith({
      token: validToken,
      newPassword: 'NewSecurePassword2026!',
    });

    // Check success screen and CTA to login
    expect(await screen.findByText(/đặt lại mật khẩu thành công!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng nhập ngay/i })).toBeInTheDocument();
  });

  it('handles invalid or expired token (HTTP 400) and displays recovery link', async () => {
    const user = userEvent.setup();
    const badTokenError = new ApiError({
      message: 'Invalid or expired password reset token',
      status: 400,
      error: 'Bad Request',
    });

    vi.mocked(authApi.resetPassword).mockRejectedValueOnce(badTokenError);

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    const passwordInput = screen.getByLabelText(/^mật khẩu mới$/i);
    const confirmInput = screen.getByLabelText(/xác nhận mật khẩu mới/i);
    const submitBtn = screen.getByRole('button', { name: /lưu mật khẩu mới/i });

    await user.type(passwordInput, 'NewSecurePassword2026!');
    await user.type(confirmInput, 'NewSecurePassword2026!');
    await user.click(submitBtn);

    expect(await screen.findByText(/invalid or expired password reset token/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bấm vào đây để yêu cầu liên kết mới/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    );
  });

  it('handles rate limit (HTTP 429) during password reset', async () => {
    const user = userEvent.setup();
    const rateLimitError = new ApiError({
      message: 'Bạn đã thử quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
      status: 429,
      error: 'Too Many Requests',
    });

    vi.mocked(authApi.resetPassword).mockRejectedValueOnce(rateLimitError);

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    const passwordInput = screen.getByLabelText(/^mật khẩu mới$/i);
    const confirmInput = screen.getByLabelText(/xác nhận mật khẩu mới/i);
    const submitBtn = screen.getByRole('button', { name: /lưu mật khẩu mới/i });

    await user.type(passwordInput, 'NewSecurePassword2026!');
    await user.type(confirmInput, 'NewSecurePassword2026!');
    await user.click(submitBtn);

    expect(await screen.findByText(/bạn đã thử quá nhiều lần/i)).toBeInTheDocument();
  });

  it('prevents duplicate submissions while reset request is in flight', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: { message: string }) => void = () => {};
    const pendingPromise = new Promise<{ message: string }>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(authApi.resetPassword).mockReturnValueOnce(pendingPromise);

    renderWithProviders(<ResetPasswordPage />, {
      initialEntries: [`/reset-password?token=${validToken}`],
    });

    const passwordInput = screen.getByLabelText(/^mật khẩu mới$/i);
    const confirmInput = screen.getByLabelText(/xác nhận mật khẩu mới/i);
    const submitBtn = screen.getByRole('button', { name: /lưu mật khẩu mới/i });

    await user.type(passwordInput, 'NewSecurePassword2026!');
    await user.type(confirmInput, 'NewSecurePassword2026!');
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(confirmInput).toBeDisabled();
    expect(authApi.resetPassword).toHaveBeenCalledTimes(1);

    resolvePromise({ message: 'Success' });
    await waitFor(() => {
      expect(screen.getByText(/đặt lại mật khẩu thành công!/i)).toBeInTheDocument();
    });
  });
});
