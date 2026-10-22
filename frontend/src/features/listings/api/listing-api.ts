import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type { ListingQueryParams, ListingResponse, ListingSummaryResponse } from '@/types/listing';

/**
 * Listing API Service
 * Encapsulates network operations for public and authenticated listing endpoints.
 */
export const listingApi = {
  /**
   * Public: Retrieve paginated active listings with optional categoryId filter
   */
  async getListings(params?: ListingQueryParams): Promise<PageResponse<ListingSummaryResponse>> {
    return apiClient.get<PageResponse<ListingSummaryResponse>>('/api/v1/listings', { params });
  },

  /**
   * Public: Retrieve details of a single listing by its UUID
   */
  async getListingById(id: string): Promise<ListingResponse> {
    return apiClient.get<ListingResponse>(`/api/v1/listings/${id}`);
  },
};

/**
 * React Query Keys for Listings
 */
export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (params?: ListingQueryParams) => [...listingKeys.lists(), params] as const,
  details: () => [...listingKeys.all, 'detail'] as const,
  detail: (id: string) => [...listingKeys.details(), id] as const,
};

export default listingApi;
