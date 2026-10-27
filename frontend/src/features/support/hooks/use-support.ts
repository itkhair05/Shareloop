import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '../api/support-api';
import type {
  CreateSupportRequestPayload,
  MySupportRequestsParams,
  MySupportRequestsPage,
  SupportRequestResponse,
} from '@/types/support';
import type { ApiError } from '@/lib/api-error';

export const supportQueryKeys = {
  all: ['support-requests'] as const,
  my: (params?: MySupportRequestsParams) => ['support-requests', 'my', params] as const,
  detail: (id: string) => ['support-requests', 'detail', id] as const,
};

export function useMySupportRequests(params?: MySupportRequestsParams, options?: { enabled?: boolean }) {
  return useQuery<MySupportRequestsPage, ApiError>({
    queryKey: supportQueryKeys.my(params),
    queryFn: () => supportApi.getMySupportRequests(params),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useSupportRequestDetails(id?: string, options?: { enabled?: boolean }) {
  return useQuery<SupportRequestResponse, ApiError>({
    queryKey: supportQueryKeys.detail(id || ''),
    queryFn: () => supportApi.getSupportRequestDetails(id || ''),
    enabled: Boolean(id) && (options?.enabled ?? true),
  });
}

export function useCreateSupportRequest() {
  const queryClient = useQueryClient();

  return useMutation<SupportRequestResponse, ApiError, CreateSupportRequestPayload>({
    mutationFn: (payload) => supportApi.createSupportRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportQueryKeys.all });
    },
  });
}
