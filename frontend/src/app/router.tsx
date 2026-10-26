import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { HomePage } from '@/features/home/HomePage';
import { ExplorePlaceholderPage } from '@/features/explore/ExplorePlaceholderPage';
import { AboutPage } from '@/features/about/AboutPage';
import {
  CreateListingPage,
  EditListingPage,
  ListingDetailPage,
  MyListingsPage,
} from '@/features/listings';
import {
  TransactionsPage,
  TransactionDetailPage,
} from '@/features/transactions';
import { NotificationsPage } from '@/features/notifications';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminCategoriesPage } from '@/features/admin/AdminCategoriesPage';
import { AdminReviewsPage } from '@/features/admin/AdminReviewsPage';
import { NotFoundPage } from '@/features/not-found/NotFoundPage';

export const router = createBrowserRouter([
  // Public & Authenticated User-Facing Routes
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
        path: 'listings/new',
        element: (
          <ProtectedRoute>
            <CreateListingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'listings/:id',
        element: <ListingDetailPage />,
      },
      {
        path: 'listings/:id/edit',
        element: (
          <ProtectedRoute>
            <EditListingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'my-listings',
        element: (
          <ProtectedRoute>
            <MyListingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions',
        element: (
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transactions/:id',
        element: (
          <ProtectedRoute>
            <TransactionDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'about',
        element: <AboutPage />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
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

  // Protected Admin Dashboard Layout & Routes
  {
    path: '/admin',
    element: (
      <ProtectedRoute requiredRole="ADMIN">
        <AdminLayout />
      </ProtectedRoute>
    ),
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
