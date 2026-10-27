import { apiClient } from '@/lib/api-client';
import type {
  CreateReportPayload,
  ReportResponse,
  MyReportsParams,
  MyReportsPage,
} from '@/types/report';

export const reportApi = {
  createReport(payload: CreateReportPayload): Promise<ReportResponse> {
    return apiClient.post<ReportResponse>('/api/v1/reports', payload);
  },

  getMyReports(params?: MyReportsParams): Promise<MyReportsPage> {
    const queryParams: Record<string, string | number> = {};
    if (params?.status) {
      queryParams.status = params.status;
    }
    if (typeof params?.page === 'number') {
      queryParams.page = params.page;
    }
    if (typeof params?.size === 'number') {
      queryParams.size = params.size;
    }

    return apiClient.get<MyReportsPage>('/api/v1/reports/my', {
      params: queryParams,
    });
  },

  getReportDetails(id: string): Promise<ReportResponse> {
    return apiClient.get<ReportResponse>(`/api/v1/reports/${id}`);
  },
};

export default reportApi;
