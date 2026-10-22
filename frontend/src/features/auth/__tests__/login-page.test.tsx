import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '../pages/LoginPage';
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

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/register');
  });

  it('toggles password visibility when clicking toggle button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    const passwordInput = screen.getByLabelText(/^password$/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required fields and email format on client submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();

    // Invalid email format
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');
    await user.click(submitBtn);

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
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

    await user.type(screen.getByLabelText(/email address/i), 'alice@shareloop.org');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
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
      message: 'Invalid email or password',
      status: 401,
      error: 'Unauthorized',
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(unauthorizedError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/email address/i), 'wrong@shareloop.org');
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('displays error message when account is suspended or deactivated (403 Forbidden)', async () => {
    const user = userEvent.setup();
    const forbiddenError = new ApiError({
      message: 'Account is suspended',
      status: 403,
      error: 'Forbidden',
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(forbiddenError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/email address/i), 'suspended@shareloop.org');
    await user.type(screen.getByLabelText(/^password$/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/account is suspended/i);
  });

  it('displays clear message on network error without crashing', async () => {
    const user = userEvent.setup();
    const networkError = new ApiError({
      message: 'Unable to connect to the ShareLoop server',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });

    vi.mocked(authApi.login).mockRejectedValueOnce(networkError);

    renderWithProviders(<LoginPage />, { initialEntries: ['/login'] });

    await user.type(screen.getByLabelText(/email address/i), 'alice@shareloop.org');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unable to reach the server/i);
  });
});
