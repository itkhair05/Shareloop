import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { HomePage } from '@/features/home/HomePage';
import { ExplorePlaceholderPage } from '@/features/explore/ExplorePlaceholderPage';
import { AboutPage } from '@/features/about/AboutPage';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminCategoriesPage } from '@/features/admin/AdminCategoriesPage';
import { AdminReviewsPage } from '@/features/admin/AdminReviewsPage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';

export const router = createBrowserRouter([
  // Public User-Facing Routes
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'explore',
        element: <ExplorePlaceholderPage />,
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: '404',
        element: <NotFoundPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },

  // Separate Admin Dashboard Layout & Routes
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminOverviewPage />,
      },
      {
        path: 'categories',
        element: <AdminCategoriesPage />,
      },
      {
        path: 'reviews',
        element: <AdminReviewsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/admin" replace />,
      },
    ],
  },
]);

export default router;
