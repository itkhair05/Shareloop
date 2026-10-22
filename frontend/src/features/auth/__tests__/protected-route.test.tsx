import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../context';
import { renderWithProviders } from '@/test/test-utils';
import type { UserProfile } from '@/types/auth';

vi.mock('../context', () => ({
  useAuth: vi.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner when auth is initializing', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
      </Routes>,
      { initialEntries: ['/protected'] }
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByText(/đang xác thực tài khoản/i)[0]).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login preserving destination', () => {
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

    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login Page Target</div>} />
        <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
      </Routes>,
      { initialEntries: ['/protected?tab=settings'] }
    );

    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
    expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
  });

  it('renders protected content when user is authenticated', () => {
    const mockUser: UserProfile = {
      id: 'user-1',
      displayName: 'Alice User',
      email: 'alice@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route path="/protected" element={<ProtectedRoute><div>Secret Content</div></ProtectedRoute>} />
      </Routes>,
      { initialEntries: ['/protected'] }
    );

    expect(screen.getByText('Secret Content')).toBeInTheDocument();
  });

  it('denies access when user does not have required role', () => {
    const mockUser: UserProfile = {
      id: 'user-2',
      displayName: 'Normal User',
      email: 'user@shareloop.org',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <div>Admin Only Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/admin'] }
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /truy cập bị từ chối/i })).toBeInTheDocument();
    expect(screen.getByText(/không có quyền truy cập khu vực/i)).toBeInTheDocument();
    expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument();
  });

  it('grants access when user has the required ADMIN role', () => {
    const mockAdmin: UserProfile = {
      id: 'admin-1',
      displayName: 'Admin User',
      email: 'admin@shareloop.org',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: '2026-10-22T00:00:00Z',
      updatedAt: '2026-10-22T00:00:00Z',
    };

    vi.mocked(useAuth).mockReturnValue({
      user: mockAdmin,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN">
              <div>Admin Only Content</div>
            </ProtectedRoute>
          }
        />
      </Routes>,
      { initialEntries: ['/admin'] }
    );

    expect(screen.getByText('Admin Only Content')).toBeInTheDocument();
    expect(screen.queryByText(/truy cập bị từ chối/i)).not.toBeInTheDocument();
  });
});
