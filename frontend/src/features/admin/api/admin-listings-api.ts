import { apiClient } from '@/lib/api-client';
import type {
  AdminListingQueryParams,
  AdminListingsPageResponse,
  ListingResponse,
} from '@/types/admin-listing';

export const adminListingQueryKeys = {
  all: ['admin', 'listings'] as const,
  lists: () => [...adminListingQueryKeys.all, 'list'] as const,
  list: (params?: AdminListingQueryParams) =>
    [...adminListingQueryKeys.lists(), params] as const,
  details: () => [...adminListingQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminListingQueryKeys.details(), id] as const,
};

export const adminListingsApi = {
  /**
   * Retrieve platform-wide listings with optional filters, search, sorting, and pagination
   */
  getAdminListings: async (
    params?: AdminListingQueryParams
  ): Promise<AdminListingsPageResponse> => {
    return apiClient.get<AdminListingsPageResponse>('/api/v1/admin/listings', {
      params,
    });
  },

  /**
   * Retrieve full details of a specific listing
   */
  getAdminListingDetail: async (id: string): Promise<ListingResponse> => {
    return apiClient.get<ListingResponse>(`/api/v1/listings/${id}`);
  },

  /**
   * Delist / delete a listing by ID (soft-delete if references exist, hard-delete otherwise)
   */
  deleteListing: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/listings/${id}`);
  },
};

export default adminListingsApi;
