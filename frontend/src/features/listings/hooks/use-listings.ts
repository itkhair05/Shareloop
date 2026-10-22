import { useQuery } from '@tanstack/react-query';
import { listingApi, listingKeys } from '../api/listing-api';
import type { PageResponse } from '@/types/api';
import type { ListingQueryParams, ListingResponse, ListingSummaryResponse } from '@/types/listing';
import { isValidUuid } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import type { ApiError } from '@/lib/api-error';

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

/**
 * Hook to retrieve details of a single listing by UUID.
 * Validates the ID format before initiating network requests to prevent invalid calls.
 */
export function useListing(id?: string) {
  const isIdValid = Boolean(id && isValidUuid(id));

  return useQuery<ListingResponse, ApiError>({
    queryKey: listingKeys.detail(id ?? ''),
    queryFn: () => listingApi.getListingById(id!),
    enabled: isIdValid,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: (failureCount, error) => {
      // In test environments, fail immediately without waiting for retry backoff
      if (appConfig.isTest) {
        return false;
      }
      // Do not retry 404 (Not Found), 403 (Forbidden), or 400 (Bad Request)
      if (error?.status === 404 || error?.status === 403 || error?.status === 400) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export default useListings;
