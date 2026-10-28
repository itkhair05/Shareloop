import { apiClient } from '@/lib/api-client';
import type {
  AdminSupportRequestResponse,
  AdminSupportRequestsPageResponse,
  AdminSupportRequestsQueryParams,
  UpdateSupportRequestAdminRequest,
} from '@/types/admin-support';

export const adminSupportQueryKeys = {
  all: ['admin', 'support-requests'] as const,
  lists: () => [...adminSupportQueryKeys.all, 'list'] as const,
  list: (params?: AdminSupportRequestsQueryParams) =>
    [...adminSupportQueryKeys.lists(), params] as const,
  details: () => [...adminSupportQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminSupportQueryKeys.details(), id] as const,
};

export const adminSupportApi = {
  getAdminSupportRequests: async (
    params?: AdminSupportRequestsQueryParams
  ): Promise<AdminSupportRequestsPageResponse> => {
    return apiClient.get<AdminSupportRequestsPageResponse>(
      '/api/v1/admin/support-requests',
      { params }
    );
  },

  getAdminSupportRequestById: async (
    id: string
  ): Promise<AdminSupportRequestResponse> => {
    return apiClient.get<AdminSupportRequestResponse>(
      `/api/v1/admin/support-requests/${id}`
    );
  },

  updateSupportRequestAdmin: async (
    id: string,
    payload: UpdateSupportRequestAdminRequest
  ): Promise<AdminSupportRequestResponse> => {
    return apiClient.patch<AdminSupportRequestResponse>(
      `/api/v1/admin/support-requests/${id}`,
      payload
    );
  },
};

export default adminSupportApi;
