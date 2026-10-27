import { apiClient } from '@/lib/api-client';
import type { AdminDashboardStats } from '@/types/admin';

export const adminDashboardApi = {
  /**
   * Fetch platform-wide administrative metrics and operational statistics.
   * Requires ADMIN role.
   */
  getDashboardStats(): Promise<AdminDashboardStats> {
    return apiClient.get<AdminDashboardStats>('/api/v1/admin/dashboard/stats');
  },
};

export default adminDashboardApi;
