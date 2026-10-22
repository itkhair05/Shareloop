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
    expect(screen.getByRole('heading', { name: /explore community listings/i })).toBeInTheDocument();
    expect(screen.getByText(/phase 3 planned/i)).toBeInTheDocument();
  });

  it('navigates to About page', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/about'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { level: 1, name: /about shareloop/i })).toBeInTheDocument();
    expect(screen.getByText(/authentication & security/i)).toBeInTheDocument();
  });

  it('renders 404 NotFoundPage for unknown routes', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/random-missing-route'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByText('404 Not Found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to home/i })).toBeInTheDocument();
  });

  it('renders Admin layout and navigation at /admin', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Administration Console' })).toBeInTheDocument();
    expect(screen.getByText('Category Hierarchy Management')).toBeInTheDocument();
    expect(screen.getByText('Review Soft Moderation')).toBeInTheDocument();
    expect(screen.getByText(/return to public app/i)).toBeInTheDocument();
  });

  it('renders Admin Category Catalog placeholder at /admin/categories', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/categories'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Category Catalog Administration' })).toBeInTheDocument();
    expect(screen.getByText(/POST\/PUT\/PATCH \/api\/v1\/admin\/categories/i)).toBeInTheDocument();
  });

  it('renders Admin Review Moderation placeholder at /admin/reviews', () => {
    const memoryRouter = createMemoryRouter(testRoutes, {
      initialEntries: ['/admin/reviews'],
    });

    renderWithProviders(<RouterProvider router={memoryRouter} />, { withRouter: false });
    expect(screen.getByRole('heading', { name: 'Review Moderation' })).toBeInTheDocument();
    expect(screen.getByText(/DELETE \/api\/v1\/admin\/reviews\/\{reviewId\}/i)).toBeInTheDocument();
  });
});
