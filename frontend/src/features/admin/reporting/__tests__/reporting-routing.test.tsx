import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { router } from '@/app/router';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { renderWithProviders } from '@/test/test-utils';

describe('reporting route and navigation', () => {
  it('registers /admin/reporting without replacing the existing moderation route', () => {
    const adminRoute = router.routes.find((route) => route.path === '/admin');
    const children = adminRoute?.children ?? [];

    expect(children.some((route) => route.path === 'reporting')).toBe(true);
    expect(children.some((route) => route.path === 'reports')).toBe(true);
  });

  it('exposes the Báo cáo & Thống kê navigation item pointing at /admin/reporting', () => {
    renderWithProviders(<AdminLayout />, { initialEntries: ['/admin'] });

    const link = screen.getByRole('link', { name: /báo cáo & thống kê/i });
    expect(link).toHaveAttribute('href', '/admin/reporting');

    // The moderation page keeps its original navigation entry.
    expect(screen.getByRole('link', { name: 'Báo cáo vi phạm' })).toHaveAttribute(
      'href',
      '/admin/reports'
    );
  });
});
