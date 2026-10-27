import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportApi } from '../api/report-api';
import type {
  CreateReportPayload,
  MyReportsParams,
  MyReportsPage,
  ReportResponse,
} from '@/types/report';
import type { ApiError } from '@/lib/api-error';

export const reportQueryKeys = {
  all: ['reports'] as const,
  my: (params?: MyReportsParams) => ['reports', 'my', params] as const,
  detail: (id: string) => ['reports', 'detail', id] as const,
};

export function useMyReports(params?: MyReportsParams, options?: { enabled?: boolean }) {
  return useQuery<MyReportsPage, ApiError>({
    queryKey: reportQueryKeys.my(params),
    queryFn: () => reportApi.getMyReports(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useReportDetails(id?: string, options?: { enabled?: boolean }) {
  return useQuery<ReportResponse, ApiError>({
    queryKey: reportQueryKeys.detail(id || ''),
    queryFn: () => reportApi.getReportDetails(id || ''),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation<ReportResponse, ApiError, CreateReportPayload>({
    mutationFn: (payload) => reportApi.createReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.all });
    },
  });
}
