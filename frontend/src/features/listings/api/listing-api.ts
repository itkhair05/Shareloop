import { apiClient } from '@/lib/api-client';
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

  /**
   * Authenticated: Retrieve paginated listings owned by current user
   */
  async getMyListings(params?: MyListingsQueryParams): Promise<PageResponse<ListingSummaryResponse>> {
    return apiClient.get<PageResponse<ListingSummaryResponse>>('/api/v1/listings/mine', { params });
  },

  /**
   * Authenticated: Create a new listing owned by current user
   */
  async createListing(payload: CreateListingRequest): Promise<ListingResponse> {
    return apiClient.post<ListingResponse, CreateListingRequest>('/api/v1/listings', payload);
  },

  /**
   * Authenticated: Update an existing listing owned by current user
   */
  async updateListing(id: string, payload: UpdateListingRequest): Promise<ListingResponse> {
    return apiClient.put<ListingResponse, UpdateListingRequest>(`/api/v1/listings/${id}`, payload);
  },

  /**
   * Authenticated: Delete an existing listing owned by current user
   */
  async deleteListing(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/listings/${id}`);
  },

  /**
   * Authenticated: Upload an image file (JPEG/PNG up to 5 MiB)
   */
  async uploadImage(file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<FileUploadResponse, FormData>('/api/v1/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

/**
 * React Query Keys for Listings
 */
export const listingKeys = {
  all: ['listings'] as const,
  lists: () => [...listingKeys.all, 'list'] as const,
  list: (params?: ListingQueryParams) => [...listingKeys.lists(), params] as const,
  mineLists: () => [...listingKeys.all, 'mine'] as const,
  mine: (params?: MyListingsQueryParams) => [...listingKeys.mineLists(), params] as const,
  details: () => [...listingKeys.all, 'detail'] as const,
  detail: (id: string) => [...listingKeys.details(), id] as const,
};

export default listingApi;
