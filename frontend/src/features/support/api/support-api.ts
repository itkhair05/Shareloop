import { apiClient } from '@/lib/api-client';
import type {
  CreateSupportRequestPayload,
  SupportRequestResponse,
  MySupportRequestsParams,
  MySupportRequestsPage,
} from '@/types/support';

export const supportApi = {
  createSupportRequest(payload: CreateSupportRequestPayload): Promise<SupportRequestResponse> {
    return apiClient.post<SupportRequestResponse>('/api/v1/support-requests', payload);
  },

  getMySupportRequests(params?: MySupportRequestsParams): Promise<MySupportRequestsPage> {
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

    return apiClient.get<MySupportRequestsPage>('/api/v1/support-requests/my', {
      params: queryParams,
    });
  },

  getSupportRequestDetails(id: string): Promise<SupportRequestResponse> {
    return apiClient.get<SupportRequestResponse>(`/api/v1/support-requests/${id}`);
  },
};

export default supportApi;
