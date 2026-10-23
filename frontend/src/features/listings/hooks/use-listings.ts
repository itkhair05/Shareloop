import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listingApi, listingKeys } from '../api/listing-api';
import type { PageResponse } from '@/types/api';
import type {
  CreateListingRequest,
  ListingQueryParams,
  ListingResponse,
  ListingSummaryResponse,
  MyListingsQueryParams,
  UpdateListingRequest,
} from '@/types/listing';
import type { FileUploadResponse } from '@/types/file';
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

/**
 * Hook to retrieve listings owned by the authenticated user
 */
export function useMyListings(params?: MyListingsQueryParams) {
  return useQuery<PageResponse<ListingSummaryResponse>, ApiError>({
    queryKey: listingKeys.mine(params),
    queryFn: () => listingApi.getMyListings(params),
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

/**
 * Hook to create a new listing
 */
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation<ListingResponse, ApiError, CreateListingRequest>({
    mutationFn: (payload) => listingApi.createListing(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.all });
      queryClient.setQueryData(listingKeys.detail(created.id), created);
    },
  });
}

/**
 * Hook to update an existing listing
 */
export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation<ListingResponse, ApiError, { id: string; payload: UpdateListingRequest }>({
    mutationFn: ({ id, payload }) => listingApi.updateListing(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.all });
      queryClient.setQueryData(listingKeys.detail(updated.id), updated);
    },
  });
}

/**
 * Hook to delete an existing listing
 */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, string>({
    mutationFn: (id) => listingApi.deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingKeys.all });
    },
  });
}

/**
 * Hook to upload an image file
 */
export function useUploadImage() {
  return useMutation<FileUploadResponse, ApiError, File>({
    mutationFn: (file) => listingApi.uploadImage(file),
  });
}

export default useListings;
