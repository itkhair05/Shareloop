import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminReportKeys, adminReportsApi } from '../api/admin-reports-api';
import type {
  AdminReportResponse,
  AdminReportsQueryParams,
  UpdateReportAdminRequest,
} from '@/types/admin-report';
import type { PageResponse } from '@/types/api';

/**
 * Hook to fetch paginated violation reports for administrators
 */
export function useAdminReports(params?: AdminReportsQueryParams) {
  return useQuery<PageResponse<AdminReportResponse>, Error>({
    queryKey: adminReportKeys.list(params),
    queryFn: () => adminReportsApi.getAdminReports(params),
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch detailed information of a specific report
 */
export function useAdminReportDetail(reportId: string | null) {
  return useQuery<AdminReportResponse, Error>({
    queryKey: adminReportKeys.detail(reportId ?? ''),
    queryFn: () => {
      if (!reportId) throw new Error('Report ID is required');
      return adminReportsApi.getAdminReportById(reportId);
    },
    enabled: Boolean(reportId),
    staleTime: 30000,
  });
}

/**
 * Mutation hook to update report status and resolution notes
 */
export function useUpdateReportAdmin() {
  const queryClient = useQueryClient();

  return useMutation<AdminReportResponse, Error, { id: string; payload: UpdateReportAdminRequest }>({
    mutationFn: ({ id, payload }) => adminReportsApi.updateReportAdmin(id, payload),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: adminReportKeys.lists() });
      queryClient.setQueryData(adminReportKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
