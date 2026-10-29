import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminListingQueryKeys, adminListingsApi } from '../api/admin-listings-api';
import type { AdminListingQueryParams } from '@/types/admin-listing';

export function useAdminListings(params: AdminListingQueryParams = {}) {
  return useQuery({
    queryKey: adminListingQueryKeys.list(params),
    queryFn: () => adminListingsApi.getAdminListings(params),
  });
}

export function useAdminListingDetail(id: string | null) {
  return useQuery({
    queryKey: adminListingQueryKeys.detail(id || ''),
    queryFn: () => adminListingsApi.getAdminListingDetail(id!),
    enabled: !!id,
  });
}

export function useAdminDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adminListingsApi.deleteListing(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: adminListingQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminListingQueryKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
