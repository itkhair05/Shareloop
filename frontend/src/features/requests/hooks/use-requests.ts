import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestApi, requestKeys } from '../api/request-api';
import { listingKeys } from '@/features/listings/api/listing-api';
import type { PageResponse } from '@/types/api';
import type {
  CreateListingRequestDto,
  ListingRequestResponse,
  ListingRequestsQueryParams,
  MyRequestsQueryParams,
  UpdateListingRequestStatusRequest,
} from '@/types/request';
import { isValidUuid } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve requests submitted for a specific listing (owner view).
 * Validates the listing UUID before dispatching network requests.
 */
export function useListingRequests(
  listingId?: string,
  params?: ListingRequestsQueryParams,
  options?: { enabled?: boolean }
) {
  const isIdValid = Boolean(listingId && isValidUuid(listingId));

  return useQuery<PageResponse<ListingRequestResponse>, ApiError>({
    queryKey: requestKeys.listing(listingId ?? '', params),
    queryFn: () => requestApi.getRequestsForListing(listingId!, params),
    enabled: (options?.enabled ?? true) && isIdValid,
    staleTime: 1000 * 60 * 1, // 1 minute
    retry: (failureCount, error) => {
      if (appConfig.isTest) {
        return false;
      }
      if (error?.status === 404 || error?.status === 403 || error?.status === 400 || error?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve listing requests submitted by the authenticated user.
 */
export function useMyRequests(
  params?: MyRequestsQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery<PageResponse<ListingRequestResponse>, ApiError>({
    queryKey: requestKeys.mine(params),
    queryFn: () => requestApi.getMyRequests(params),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 1, // 1 minute
    retry: (failureCount, error) => {
      if (appConfig.isTest) {
        return false;
      }
      if (error?.status === 404 || error?.status === 403 || error?.status === 400 || error?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Mutation payload for creating a request
 */
export interface CreateRequestVariables {
  listingId: string;
  payload?: CreateListingRequestDto;
}

/**
 * Hook to submit a new listing request for an eligible GIVEAWAY or SALE listing.
 * On success, invalidates current user's request list and listing requests list.
 */
export function useCreateRequest() {
  const queryClient = useQueryClient();

  return useMutation<ListingRequestResponse, ApiError, CreateRequestVariables>({
    mutationFn: ({ listingId, payload }) => requestApi.createRequest(listingId, payload),
    onSuccess: (_created, variables) => {
      // Invalidate current user's requests feed
      queryClient.invalidateQueries({ queryKey: requestKeys.mineLists() });
      // Invalidate the requests list for this specific listing
      queryClient.invalidateQueries({ queryKey: requestKeys.listing(variables.listingId) });
      queryClient.invalidateQueries({ queryKey: requestKeys.listingLists() });
    },
  });
}

/**
 * Mutation payload for updating a request's status
 */
export interface UpdateRequestStatusVariables {
  requestId: string;
  payload: UpdateListingRequestStatusRequest;
}

/**
 * Hook to accept or reject a pending listing request.
 * On success, invalidates requests caches and associated listing detail cache
 * (since accepting transitions the listing to RESERVED).
 */
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation<ListingRequestResponse, ApiError, UpdateRequestStatusVariables>({
    mutationFn: ({ requestId, payload }) =>
      requestApi.updateRequestStatus(requestId, payload),
    onSuccess: (updated) => {
      // Invalidate all request queries to keep lists accurate
      queryClient.invalidateQueries({ queryKey: requestKeys.all });

      // If accepted, listing status transitions to RESERVED, so refresh listing caches
      if (updated?.listing?.id) {
        queryClient.invalidateQueries({ queryKey: listingKeys.detail(updated.listing.id) });
        queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
        queryClient.invalidateQueries({ queryKey: listingKeys.mineLists() });
      }
    },
  });
}
