import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { level: 1, name: /về shareloop/i })).toBeInTheDocument();
    expect(screen.getByText(/xác thực & bảo mật/i)).toBeInTheDocument();
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

  it('renders Admin Category Catalog placeholder at /admin/categories', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/categories'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Quản trị danh mục ngành hàng' })).toBeInTheDocument();
    expect(screen.getByText(/POST\/PUT\/PATCH \/api\/v1\/admin\/categories/i)).toBeInTheDocument();
  });

  it('renders Admin Review Moderation placeholder at /admin/reviews', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/reviews'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Kiểm duyệt đánh giá' })).toBeInTheDocument();
    expect(screen.getByText(/DELETE \/api\/v1\/admin\/reviews\/\{reviewId\}/i)).toBeInTheDocument();
  });
});
