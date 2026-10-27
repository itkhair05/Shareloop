import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi } from '../api/admin-dashboard-api';
import type { AdminDashboardStats } from '@/types/admin';

export const ADMIN_DASHBOARD_QUERY_KEY = ['admin', 'dashboard', 'stats'] as const;

export function useAdminDashboardStats() {
  return useQuery<AdminDashboardStats>({
    queryKey: ADMIN_DASHBOARD_QUERY_KEY,
    queryFn: () => adminDashboardApi.getDashboardStats(),
    staleTime: 30 * 1000, // 30 seconds fresh cache
    refetchOnWindowFocus: false,
  });
}
