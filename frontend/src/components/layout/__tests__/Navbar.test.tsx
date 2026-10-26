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
    expect(screen.getByRole('link', { name: /^trang chủ$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^khám phá$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^trợ giúp$/i })).toBeInTheDocument();

    // Log In and Sign Up buttons present
    expect(screen.getByRole('link', { name: /đăng nhập/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /đăng ký/i })).toHaveAttribute('href', '/register');

    // Admin Console and authenticated links must NOT be shown to unauthenticated users
    expect(screen.queryByRole('link', { name: /bảng quản trị/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /bài đăng của tôi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^đăng bài$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /đăng xuất/i })).not.toBeInTheDocument();
  });

  it('renders user identity, my listings, create listing, and logout, but hides admin console for standard USER role', async () => {
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
    expect(screen.getByRole('link', { name: /bài đăng của tôi/i })).toHaveAttribute('href', '/my-listings');
    expect(screen.getByRole('link', { name: /^đăng bài$/i })).toHaveAttribute('href', '/listings/new');
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument();

    // Profile link must be rendered and point to /profile
    const profileLink = screen.getByRole('link', { name: /xem hồ sơ cá nhân/i });
    expect(profileLink).toBeInTheDocument();
    expect(profileLink).toHaveAttribute('href', '/profile');

    // Standard user must NOT see Admin Console
    expect(screen.queryByRole('link', { name: /bảng quản trị/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/đăng ký/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /đăng xuất/i }));
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
    expect(screen.getByRole('link', { name: /bảng quản trị/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByText('Quản trị viên')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /đăng xuất/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /xem hồ sơ cá nhân/i })).toHaveAttribute('href', '/profile');
  });

  it('renders profile link in both desktop and mobile navigation layouts', async () => {
    const user = userEvent.setup();
    const testUser: UserProfile = {
      id: 'usr-2',
      displayName: 'Lê Hoàng Nam',
      email: 'nam.le@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-26T00:00:00Z',
      updatedAt: '2026-10-26T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: testUser,
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

    // Desktop profile link exists with proper aria-label and destination
    const desktopProfileLink = screen.getByRole('link', { name: /xem hồ sơ cá nhân/i });
    expect(desktopProfileLink).toHaveAttribute('href', '/profile');
    expect(desktopProfileLink).toHaveTextContent('Lê Hoàng Nam');

    // Open mobile menu
    const menuToggle = screen.getByRole('button', { name: /mở menu điều hướng/i });
    await user.click(menuToggle);

    // Both desktop and mobile profile links now exist
    const profileLinks = screen.getAllByRole('link', { name: /xem hồ sơ cá nhân/i });
    expect(profileLinks).toHaveLength(2);
    expect(profileLinks[0]).toHaveAttribute('href', '/profile');
    expect(profileLinks[1]).toHaveAttribute('href', '/profile');

    // Clicking mobile profile link closes mobile menu
    await user.click(profileLinks[1]);
    expect(screen.queryByRole('button', { name: /đóng menu điều hướng/i })).not.toBeInTheDocument();
  });
});
