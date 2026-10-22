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

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password \(min\. 8 characters\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('validates required fields on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/display name is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/please confirm your password/i)).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it('validates password length and password confirmation mismatch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.type(screen.getByLabelText(/display name/i), 'Bob Builder');
    await user.type(screen.getByLabelText(/email address/i), 'bob@shareloop.org');
    await user.type(screen.getByLabelText(/password \(min\. 8 characters\)/i), 'short'); // < 8 chars
    await user.type(screen.getByLabelText(/^confirm password$/i), 'different');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
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

    await user.type(screen.getByLabelText(/display name/i), 'Bob Builder');
    await user.type(screen.getByLabelText(/email address/i), 'bob@shareloop.org');
    await user.type(screen.getByLabelText(/password \(min\. 8 characters\)/i), 'strongPass123');
    await user.type(screen.getByLabelText(/^confirm password$/i), 'strongPass123');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        displayName: 'Bob Builder',
        email: 'bob@shareloop.org',
        password: 'strongPass123',
      });
      expect(tokenStorage.getAccessToken()).toBe('registered-jwt-token-abc');
    });
  });

  it('displays error on duplicate email (409 Conflict)', async () => {
    const user = userEvent.setup();
    const duplicateError = new ApiError({
      message: 'An account with this email already exists',
      status: 409,
      error: 'Conflict',
    });

    vi.mocked(authApi.register).mockRejectedValueOnce(duplicateError);

    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    await user.type(screen.getByLabelText(/display name/i), 'Bob Duplicate');
    await user.type(screen.getByLabelText(/email address/i), 'existing@shareloop.org');
    await user.type(screen.getByLabelText(/password \(min\. 8 characters\)/i), 'password123');
    await user.type(screen.getByLabelText(/^confirm password$/i), 'password123');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already registered/i);
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('toggles password and confirm-password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

    const passwordInput = screen.getByLabelText(/password \(min\. 8 characters\)/i);
    const confirmInput = screen.getByLabelText(/^confirm password$/i);

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmInput).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /^show password$/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /show confirm password/i }));
    expect(confirmInput).toHaveAttribute('type', 'text');
  });
});
