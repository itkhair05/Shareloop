import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Navbar } from '../Navbar';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('Navbar Authentication and Role-Aware Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders public navigation and auth action links when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(<Navbar />);

    expect(screen.getByText('ShareLoop')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^explore$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^about$/i })).toBeInTheDocument();

    // Log In and Sign Up buttons present
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/register');

    // Admin Console must NOT be shown to unauthenticated users
    expect(screen.queryByRole('link', { name: /admin console/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('renders user identity and logout, but hides admin console for standard USER role', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();
    const standardUser: UserProfile = {
      id: 'usr-1',
      displayName: 'Sarah Neighbor',
      email: 'sarah@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: standardUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: mockLogout,
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(<Navbar />);

    expect(screen.getByText('Sarah Neighbor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();

    // Standard user must NOT see Admin Console
    expect(screen.queryByRole('link', { name: /admin console/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /log out/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders Admin Console link and Admin badge for ADMIN role', () => {
    const adminUser: UserProfile = {
      id: 'adm-1',
      displayName: 'System Admin',
      email: 'admin@shareloop.org',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(<Navbar />);

    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /admin console/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
  });
});
