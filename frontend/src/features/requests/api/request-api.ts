import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  CreateListingRequestDto,
  ListingRequestResponse,
  ListingRequestsQueryParams,
  MyRequestsQueryParams,
  UpdateListingRequestStatusRequest,
} from '@/types/request';

/**
 * Service for Listing Request operations (requests submitted for GIVEAWAY/SALE listings).
 * Encapsulates network operations for all verified backend endpoints in ListingRequestController.
 */
export const requestApi = {
  /**
   * Submit a request for an eligible GIVEAWAY or SALE listing.
   * POST /api/v1/listings/{listingId}/requests
   */
  async createRequest(
    listingId: string,
    payload?: CreateListingRequestDto
  ): Promise<ListingRequestResponse> {
    return apiClient.post<ListingRequestResponse, CreateListingRequestDto>(
      `/api/v1/listings/${encodeURIComponent(listingId)}/requests`,
      payload
    );
  },

  /**
   * Listing owner views paginated requests submitted for their listing.
   * GET /api/v1/listings/{listingId}/requests
   */
  async getRequestsForListing(
    listingId: string,
    params?: ListingRequestsQueryParams
  ): Promise<PageResponse<ListingRequestResponse>> {
    return apiClient.get<PageResponse<ListingRequestResponse>>(
      `/api/v1/listings/${encodeURIComponent(listingId)}/requests`,
      { params }
    );
  },

  /**
   * Authenticated user views their own submitted listing requests.
   * GET /api/v1/listing-requests/mine
   */
  async getMyRequests(
    params?: MyRequestsQueryParams
  ): Promise<PageResponse<ListingRequestResponse>> {
    return apiClient.get<PageResponse<ListingRequestResponse>>(
      '/api/v1/listing-requests/mine',
      { params }
    );
  },

  /**
   * Listing owner accepts or rejects a pending listing request.
   * PATCH /api/v1/listing-requests/{requestId}/status
   */
  async updateRequestStatus(
    requestId: string,
    payload: UpdateListingRequestStatusRequest
  ): Promise<ListingRequestResponse> {
    return apiClient.patch<ListingRequestResponse, UpdateListingRequestStatusRequest>(
      `/api/v1/listing-requests/${encodeURIComponent(requestId)}/status`,
      payload
    );
  },
};

/**
 * React Query Keys for Listing Requests
 */
export const requestKeys = {
  all: ['requests'] as const,
  mineLists: () => [...requestKeys.all, 'mine'] as const,
  mine: (params?: MyRequestsQueryParams) => [...requestKeys.mineLists(), params] as const,
  listingLists: () => [...requestKeys.all, 'listing'] as const,
  listing: (listingId: string, params?: ListingRequestsQueryParams) =>
    [...requestKeys.listingLists(), listingId, params] as const,
};

export default requestApi;
