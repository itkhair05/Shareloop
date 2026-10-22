import { useQuery } from '@tanstack/react-query';
import { listingApi, listingKeys } from '../api/listing-api';
import type { PageResponse } from '@/types/api';
import type { ListingQueryParams, ListingSummaryResponse } from '@/types/listing';

/**
 * Hook to retrieve active community listings
 * Automatically refetches or serves cached results when params (e.g. categoryId) change.
 */
export function useListings(params?: ListingQueryParams) {
  return useQuery<PageResponse<ListingSummaryResponse>>({
    queryKey: listingKeys.list(params),
    queryFn: () => listingApi.getListings(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export default useListings;
