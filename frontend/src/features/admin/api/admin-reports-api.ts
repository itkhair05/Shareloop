import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  AdminReportResponse,
  AdminReportsQueryParams,
  UpdateReportAdminRequest,
} from '@/types/admin-report';

/**
 * React Query Keys for Admin Reports
 */
export const adminReportKeys = {
  all: ['admin', 'reports'] as const,
  lists: () => [...adminReportKeys.all, 'list'] as const,
  list: (params?: AdminReportsQueryParams) => [...adminReportKeys.lists(), params ?? {}] as const,
  details: () => [...adminReportKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminReportKeys.details(), id] as const,
};

export const adminReportsApi = {
  /**
   * List violation reports with optional status, targetType, category filters, and pagination.
   * Requires ADMIN role.
   */
  getAdminReports(params?: AdminReportsQueryParams): Promise<PageResponse<AdminReportResponse>> {
    const cleanParams: Record<string, unknown> = {};

    if (params) {
      if (params.status) {
        cleanParams.status = params.status;
      }
      if (params.targetType) {
        cleanParams.targetType = params.targetType;
      }
      if (params.category) {
        cleanParams.category = params.category;
      }
      if (params.page !== undefined && params.page >= 0) {
        cleanParams.page = params.page;
      }
      if (params.size !== undefined && params.size > 0) {
        cleanParams.size = params.size;
      }
    }

    return apiClient.get<PageResponse<AdminReportResponse>>('/api/v1/admin/reports', {
      params: cleanParams,
    });
  },

  /**
   * Inspect details of a report including internal resolution notes.
   * Requires ADMIN role.
   */
  getAdminReportById(id: string): Promise<AdminReportResponse> {
    return apiClient.get<AdminReportResponse>(`/api/v1/admin/reports/${id}`);
  },

  /**
   * Update report status and internal resolution notes.
   * Requires ADMIN role.
   */
  updateReportAdmin(
    id: string,
    payload: UpdateReportAdminRequest
  ): Promise<AdminReportResponse> {
    return apiClient.patch<AdminReportResponse>(`/api/v1/admin/reports/${id}`, payload);
  },
};

export default adminReportsApi;
