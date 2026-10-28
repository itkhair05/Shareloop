import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminSupportApi, adminSupportQueryKeys } from '../api/admin-support-api';
import type {
  AdminSupportRequestsQueryParams,
  UpdateSupportRequestAdminRequest,
} from '@/types/admin-support';

export function useAdminSupportRequests(params: AdminSupportRequestsQueryParams = {}) {
  return useQuery({
    queryKey: adminSupportQueryKeys.list(params),
    queryFn: () => adminSupportApi.getAdminSupportRequests(params),
  });
}

export function useAdminSupportRequestDetail(id: string | null) {
  return useQuery({
    queryKey: adminSupportQueryKeys.detail(id || ''),
    queryFn: () => adminSupportApi.getAdminSupportRequestById(id!),
    enabled: !!id,
  });
}

export function useUpdateAdminSupportRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateSupportRequestAdminRequest;
    }) => adminSupportApi.updateSupportRequestAdmin(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminSupportQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminSupportQueryKeys.detail(data.id) });
      queryClient.setQueryData(adminSupportQueryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: ['support-requests'] });
    },
  });
}
