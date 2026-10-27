import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { MainLayout } from '@/components/layout/MainLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { HomePage } from '@/features/home/HomePage';
import { ExplorePlaceholderPage } from '@/features/explore/ExplorePlaceholderPage';
import { AboutPage } from '@/features/about/AboutPage';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminCategoriesPage } from '@/features/admin/AdminCategoriesPage';
import { AdminReviewsPage } from '@/features/admin/AdminReviewsPage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';

const testRoutes = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePlaceholderPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'reviews', element: <AdminReviewsPage /> },
    ],
  },
];

describe('Application Routing', () => {
  it('navigates to Explore page', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/explore'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: /khám phá đồ dùng cộng đồng/i })).toBeInTheDocument();
    expect(screen.getByText(/duyệt tìm đồ dùng cho tặng, trao đổi/i)).toBeInTheDocument();
  });

  it('navigates to About page', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/about'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { level: 1, name: /trung tâm trợ giúp/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /câu hỏi thường gặp/i })).toBeInTheDocument();
  });

  it('renders 404 NotFoundPage for unknown routes', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/random-missing-route'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByText('404 - Không tìm thấy trang')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Trang không tồn tại' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quay về trang chủ/i })).toBeInTheDocument();
  });

  it('renders Admin layout and navigation at /admin', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Bảng điều khiển quản trị' })).toBeInTheDocument();
    expect(screen.getByText('Quản lý phân cấp danh mục')).toBeInTheDocument();
    expect(screen.getByText('Kiểm duyệt đánh giá')).toBeInTheDocument();
    expect(screen.getByText(/quay lại ứng dụng chính/i)).toBeInTheDocument();
  });

  it('renders Admin Categories page at /admin/categories', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/categories'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Quản trị danh mục ngành hàng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thêm danh mục/i })).toBeInTheDocument();
  });

  it('renders Admin Review Moderation placeholder at /admin/reviews', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/reviews'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Kiểm duyệt đánh giá' })).toBeInTheDocument();
    expect(screen.getByText(/DELETE \/api\/v1\/admin\/reviews\/\{reviewId\}/i)).toBeInTheDocument();
  });

  it('cleanly transitions from Admin to Public Home layout without retaining admin sidebar or headers', async () => {
    const user = userEvent.setup();
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Bảng điều khiển quản trị' })).toBeInTheDocument();

    // Click "Quay lại ứng dụng chính" in AdminLayout sidebar
    const backLink = screen.getByRole('link', { name: /quay lại ứng dụng chính/i });
    await user.click(backLink);

    // Verify Public Home and Navbar are rendered, and AdminLayout elements are gone
    expect(screen.getByRole('heading', { level: 1, name: /ShareLoop/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bảng điều khiển quản trị' })).not.toBeInTheDocument();
    expect(screen.queryByText('Quản lý phân cấp danh mục')).not.toBeInTheDocument();
  });
});
