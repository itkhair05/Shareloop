/**
 * Admin Dashboard Statistics Response Type
 * Matches backend GET /api/v1/admin/dashboard/stats
 */
export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalListings: number;
  activeListings: number;
  totalTransactions: number;
  completedTransactions: number;
  totalCategories: number;
  pendingSupportRequests: number;
  inProgressSupportRequests: number;
  pendingReports: number;
  investigatingReports: number;
}
